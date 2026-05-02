const mongoose = require("mongoose");
const Bed = require("../models/Bed");
const PgProperty = require("../models/PgProperty");
const Booking = require("../models/Booking");
const User = require("../models/User");

async function createPg(req, res) {
  try {
    const { name, propertyType, address, city, location, amenities, images, foodMenu } = req.body;
    const pg = await PgProperty.create({
      ownerId: req.user.userId,
      name,
      propertyType,
      address,
      city,
      location,
      amenities: amenities || [],
      images: Array.isArray(images) ? images : [],
      foodMenu: foodMenu && typeof foodMenu === "object" ? foodMenu : {},
    });
    return res.status(201).json(pg);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create PG", error: error.message });
  }
}

async function addBed(req, res) {
  try {
    const { pgId } = req.params;
    const { roomNo, bedNo, sharingType, genderTag, ac, attachedBath, priceMonthly } = req.body;

    const pg = await PgProperty.findById(pgId);
    if (!pg) return res.status(404).json({ message: "PG not found" });

    if (req.user.role !== "ADMIN" && pg.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bed = await Bed.create({
      pgId,
      roomNo,
      bedNo,
      sharingType,
      genderTag,
      ac,
      attachedBath,
      priceMonthly,
    });
    return res.status(201).json(bed);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add bed", error: error.message });
  }
}

async function searchPgs(req, res) {
  try {
    const { city, gender, maxRent, verified, propertyType, sharing, sort, amenities } = req.query;
    const match = { status: "ACTIVE" };

    if (city) match.city = city;
    if (verified === "true" || verified === "1") match.verified = true;
    if (propertyType && ["LADIES", "GENTS", "COLIVING"].includes(propertyType)) {
      match.propertyType = propertyType;
    }
    if (amenities) {
      const list = String(amenities)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) {
        match.amenities = { $all: list };
      }
    }

    const sharingTypes = sharing
      ? String(sharing)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => [1, 2, 3, 4].includes(n))
      : [];

    const bedMatchCond = [
      { $eq: ["$$bed.status", "VACANT"] },
      ...(gender ? [{ $in: ["$$bed.genderTag", [gender, "UNISEX"]] }] : []),
      ...(maxRent && !Number.isNaN(Number(maxRent))
        ? [{ $lte: ["$$bed.priceMonthly", Number(maxRent)] }]
        : []),
      ...(sharingTypes.length ? [{ $in: ["$$bed.sharingType", sharingTypes] }] : []),
    ];

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "beds",
          localField: "_id",
          foreignField: "pgId",
          as: "beds",
        },
      },
      {
        $addFields: {
          vacantMatching: {
            $filter: {
              input: "$beds",
              as: "bed",
              cond: { $and: bedMatchCond },
            },
          },
        },
      },
      {
        $addFields: {
          vacantBeds: { $size: "$vacantMatching" },
          minRent: { $min: "$vacantMatching.priceMonthly" },
        },
      },
      { $match: { vacantBeds: { $gt: 0 } } },
      {
        $project: {
          beds: 0,
          vacantMatching: 0,
        },
      },
      ...(sort === "rent_asc"
        ? [{ $sort: { minRent: 1, vacantBeds: -1 } }]
        : sort === "rent_desc"
          ? [{ $sort: { minRent: -1, vacantBeds: -1 } }]
          : sort === "newest"
            ? [{ $sort: { createdAt: -1, vacantBeds: -1 } }]
            : [{ $sort: { vacantBeds: -1, createdAt: -1 } }]),
    ];

    const results = await PgProperty.aggregate(pipeline);
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: "Search failed", error: error.message });
  }
}

async function getPgDetails(req, res) {
  try {
    const { pgId } = req.params;
    if (!mongoose.isValidObjectId(pgId)) {
      return res.status(400).json({ message: "Invalid PG id" });
    }

    const pg = await PgProperty.findById(pgId).lean();
    if (!pg) return res.status(404).json({ message: "PG not found" });

    const ownerDoc = await User.findById(pg.ownerId).select("name phone email").lean();
    const owner = ownerDoc
      ? {
          name: ownerDoc.name,
          phone: ownerDoc.phone,
          email: ownerDoc.email || "",
        }
      : null;

    const beds = await Bed.find({ pgId }).sort({ roomNo: 1, bedNo: 1 }).lean();
    const rooms = beds.reduce((acc, bed) => {
      if (!acc[bed.roomNo]) acc[bed.roomNo] = [];
      acc[bed.roomNo].push(bed);
      return acc;
    }, {});

    const statusBreakdown = beds.reduce(
      (acc, bed) => {
        acc[bed.status] = (acc[bed.status] || 0) + 1;
        return acc;
      },
      { VACANT: 0, BLOCKED: 0, OCCUPIED: 0, LEAVING: 0 }
    );

    const foodMenu = pg.foodMenu || { morning: "", evening: "", night: "" };

    return res.json({
      pg: {
        ...pg,
        foodMenu,
        images: Array.isArray(pg.images) ? pg.images : [],
      },
      owner,
      stats: {
        totalBeds: beds.length,
        minRent: beds.length ? Math.min(...beds.map((b) => b.priceMonthly)) : 0,
        maxRent: beds.length ? Math.max(...beds.map((b) => b.priceMonthly)) : 0,
        statusBreakdown,
      },
      rooms: Object.entries(rooms).map(([roomNo, roomBeds]) => ({
        roomNo,
        beds: roomBeds,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch PG details", error: error.message });
  }
}

async function blockBed(req, res) {
  try {
    const { bedId } = req.params;
    if (!mongoose.isValidObjectId(bedId)) {
      return res.status(400).json({ message: "Invalid bed id" });
    }

    const lockExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const bed = await Bed.findOneAndUpdate(
      { _id: bedId, status: "VACANT" },
      { $set: { status: "BLOCKED", lockExpiresAt: lockExpiry } },
      { new: true }
    );

    if (!bed) {
      return res.status(409).json({ message: "Bed is no longer available" });
    }

    const booking = await Booking.create({
      userId: req.user.userId,
      pgId: bed.pgId,
      bedId: bed._id,
      bookingType: "TOKEN",
      status: "PENDING",
      amount: 999,
      lockExpiresAt: lockExpiry,
      notes: "Auto-created on bed block before payment webhook confirmation",
    });

    return res.json({
      message: "Bed blocked for 48 hours. Proceed with token payment.",
      bed,
      bookingId: booking._id,
      tokenAmount: 999,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to block bed", error: error.message });
  }
}

async function updateBedStatus(req, res) {
  try {
    const { bedId } = req.params;
    const { status } = req.body;

    const allowed = ["VACANT", "BLOCKED", "OCCUPIED", "LEAVING"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const bed = await Bed.findById(bedId);
    if (!bed) return res.status(404).json({ message: "Bed not found" });

    const pg = await PgProperty.findById(bed.pgId);
    if (!pg) return res.status(404).json({ message: "PG not found" });

    if (req.user.role !== "ADMIN" && pg.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    bed.status = status;
    bed.lockExpiresAt = status === "BLOCKED" ? bed.lockExpiresAt : null;
    await bed.save();

    return res.json(bed);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update bed", error: error.message });
  }
}

module.exports = {
  createPg,
  addBed,
  searchPgs,
  getPgDetails,
  blockBed,
  updateBedStatus,
};
