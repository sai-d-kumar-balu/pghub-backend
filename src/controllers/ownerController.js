const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OwnerProfile = require("../models/OwnerProfile");
const PgProperty = require("../models/PgProperty");
const Bed = require("../models/Bed");
const Booking = require("../models/Booking");
const Ticket = require("../models/Ticket");
const Payment = require("../models/Payment");
const RentCycle = require("../models/RentCycle");

async function ensureOwnerPg(req, pgId) {
  if (!mongoose.isValidObjectId(pgId)) {
    return { err: { status: 400, message: "Invalid PG id" } };
  }
  const pg = await PgProperty.findById(pgId);
  if (!pg) {
    return { err: { status: 404, message: "PG not found" } };
  }
  if (req.user.role !== "ADMIN" && pg.ownerId.toString() !== req.user.userId) {
    return { err: { status: 403, message: "Forbidden" } };
  }
  return { pg };
}

function groupBedsIntoRooms(beds) {
  const rooms = beds.reduce((acc, bed) => {
    if (!acc[bed.roomNo]) acc[bed.roomNo] = [];
    acc[bed.roomNo].push(bed);
    return acc;
  }, {});
  const roomNos = Object.keys(rooms).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  return roomNos.map((roomNo) => ({
    roomNo,
    beds: rooms[roomNo].sort((a, b) =>
      a.bedNo.localeCompare(b.bedNo, undefined, { numeric: true, sensitivity: "base" })
    ),
  }));
}

async function getOwnerProfile(req, res) {
  try {
    const userId = req.user.userId;
    const [user, profile] = await Promise.all([
      User.findById(userId).select("-passwordHash").lean(),
      OwnerProfile.findOne({ userId }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let documentCount = 0;
    let kycDocuments = [];
    if (profile && Array.isArray(profile.kycDocuments)) {
      documentCount = profile.kycDocuments.length;
      kycDocuments = profile.kycDocuments.map((d) => ({
        fileId: d.fileId,
        kind: d.kind,
        originalName: d.originalName,
        uploadedAt: d.uploadedAt,
      }));
    }

    return res.json({
      user,
      profile: profile
        ? {
            kycStatus: profile.kycStatus,
            commissionPct: profile.commissionPct,
            pan: profile.pan,
            aadhaar: profile.aadhaar,
            gstNumber: profile.gstNumber,
            bankDetails: profile.bankDetails,
            kycReviewNotes: profile.kycReviewNotes,
            documentCount,
            kycDocuments,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profile", error: error.message });
  }
}

async function patchOwnerProfile(req, res) {
  try {
    const userId = req.user.userId;
    const { pan, aadhaar, gstNumber, bankDetails } = req.body;

    let profile = await OwnerProfile.findOne({ userId });
    if (!profile) {
      profile = await OwnerProfile.create({
        userId,
        kycStatus: "PENDING",
        pan: typeof pan === "string" ? pan : "",
        aadhaar: typeof aadhaar === "string" ? aadhaar : "",
        gstNumber: typeof gstNumber === "string" ? gstNumber : "",
        bankDetails: bankDetails && typeof bankDetails === "object" ? bankDetails : {},
      });
      return res.json({
        message: "Profile created",
        profile: profile.toObject(),
      });
    }

    if (typeof pan === "string") profile.pan = pan;
    if (typeof aadhaar === "string") profile.aadhaar = aadhaar;
    if (typeof gstNumber === "string") profile.gstNumber = gstNumber;
    if (bankDetails && typeof bankDetails === "object") {
      profile.bankDetails = {
        ...profile.bankDetails,
        ...bankDetails,
      };
    }
    if (profile.kycStatus === "REJECTED") {
      profile.kycStatus = "PENDING";
    }
    await profile.save();

    return res.json({
      message: "Profile updated",
      profile: profile.toObject(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
}

async function patchOwnerAccount(req, res) {
  try {
    const userId = req.user.userId;
    const { name, email } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string") user.email = email.trim() || undefined;

    await user.save();
    return res.json({
      message: "Account updated",
      user: { _id: user._id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update account", error: error.message });
  }
}

async function changeOwnerPassword(req, res) {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "currentPassword and newPassword (min 6 chars) required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password", error: error.message });
  }
}

async function listOwnerProperties(req, res) {
  try {
    const ownerId = req.user.userId;
    const properties = await PgProperty.find({ ownerId }).sort({ updatedAt: -1 }).lean();
    return res.json({ properties });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list properties", error: error.message });
  }
}

async function getOwnerPropertyDetail(req, res) {
  try {
    const { pgId } = req.params;
    const { err, pg } = await ensureOwnerPg(req, pgId);
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const full = await PgProperty.findById(pg._id).lean();
    const beds = await Bed.find({ pgId: pg._id }).sort({ roomNo: 1, bedNo: 1 }).lean();
    const rooms = groupBedsIntoRooms(beds);

    const statusBreakdown = beds.reduce(
      (acc, bed) => {
        acc[bed.status] = (acc[bed.status] || 0) + 1;
        return acc;
      },
      { VACANT: 0, BLOCKED: 0, OCCUPIED: 0, LEAVING: 0 }
    );

    return res.json({
      pg: full,
      stats: {
        totalBeds: beds.length,
        minRent: beds.length ? Math.min(...beds.map((b) => b.priceMonthly)) : 0,
        maxRent: beds.length ? Math.max(...beds.map((b) => b.priceMonthly)) : 0,
        statusBreakdown,
      },
      rooms,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load property", error: error.message });
  }
}

async function updateOwnerProperty(req, res) {
  try {
    const { pgId } = req.params;
    const { err, pg } = await ensureOwnerPg(req, pgId);
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const {
      name,
      propertyType,
      address,
      city,
      location,
      amenities,
      images,
      foodMenu,
      status,
    } = req.body;

    if (typeof name === "string" && name.trim()) pg.name = name.trim();
    if (propertyType && ["LADIES", "GENTS", "COLIVING"].includes(propertyType)) {
      pg.propertyType = propertyType;
    }
    if (typeof address === "string" && address.trim()) pg.address = address.trim();
    if (typeof city === "string" && city.trim()) pg.city = city.trim();
    if (location && typeof location === "object") {
      pg.location = { lat: location.lat, lng: location.lng };
    }
    if (Array.isArray(amenities)) pg.amenities = amenities;
    if (Array.isArray(images)) pg.images = images.filter((u) => typeof u === "string" && u.trim()).slice(0, 20);
    if (foodMenu && typeof foodMenu === "object") {
      pg.foodMenu = {
        morning: typeof foodMenu.morning === "string" ? foodMenu.morning : pg.foodMenu?.morning || "",
        evening: typeof foodMenu.evening === "string" ? foodMenu.evening : pg.foodMenu?.evening || "",
        night: typeof foodMenu.night === "string" ? foodMenu.night : pg.foodMenu?.night || "",
      };
    }
    if (status && ["ACTIVE", "INACTIVE"].includes(status)) {
      pg.status = status;
    }

    await pg.save();
    return res.json({ message: "Property updated", pg: pg.toObject() });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update property", error: error.message });
  }
}

async function listOwnerBookings(req, res) {
  try {
    const ownerId = req.user.userId;
    const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
    if (!pgIds.length) {
      return res.json({ bookings: [] });
    }

    const bookings = await Booking.find({ pgId: { $in: pgIds } })
      .sort({ createdAt: -1 })
      .limit(150)
      .populate({ path: "userId", select: "name phone email" })
      .populate({ path: "pgId", select: "name city" })
      .populate({ path: "bedId", select: "roomNo bedNo priceMonthly status" })
      .lean();

    return res.json({ bookings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bookings", error: error.message });
  }
}

async function listOwnerTickets(req, res) {
  try {
    const ownerId = req.user.userId;
    const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
    if (!pgIds.length) {
      return res.json({ tickets: [] });
    }

    const tickets = await Ticket.find({ pgId: { $in: pgIds } })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: "userId", select: "name phone" })
      .populate({ path: "pgId", select: "name city" })
      .lean();

    return res.json({ tickets });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tickets", error: error.message });
  }
}

async function listOwnerPayouts(req, res) {
  try {
    const ownerId = req.user.userId;
    const payments = await Payment.find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: "userId", select: "name phone" })
      .lean();

    const agg = await Payment.aggregate([
      { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), status: "SUCCESS" } },
      {
        $group: {
          _id: null,
          totalOwnerPayout: { $sum: "$ownerPayout" },
          totalPlatformFee: { $sum: "$platformFee" },
          totalGmv: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const profile = await OwnerProfile.findOne({ userId: ownerId }).select("commissionPct").lean();

    return res.json({
      payments,
      summary: agg[0] || {
        totalOwnerPayout: 0,
        totalPlatformFee: 0,
        totalGmv: 0,
        count: 0,
      },
      commissionPct: profile?.commissionPct ?? 10,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load payouts", error: error.message });
  }
}

async function listOwnerTenants(req, res) {
  try {
    const ownerId = req.user.userId;
    const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
    if (!pgIds.length) return res.json({ tenants: [] });

    const beds = await Bed.find({
      pgId: { $in: pgIds },
      status: { $in: ["OCCUPIED", "LEAVING"] },
      tenantUserId: { $ne: null },
    })
      .populate({ path: "pgId", select: "name city" })
      .populate({
        path: "tenantUserId",
        select: "name phone email gender profession address emergencyContactName emergencyContactPhone status createdAt",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const tenantIds = [...new Set(beds.map((b) => String(b.tenantUserId?._id)).filter(Boolean))];
    const rentCycles = await RentCycle.find({ tenantUserId: { $in: tenantIds } })
      .sort({ dueDate: 1 })
      .limit(500)
      .lean();

    const rentByTenant = {};
    for (const rc of rentCycles) {
      const key = String(rc.tenantUserId);
      if (!rentByTenant[key]) rentByTenant[key] = [];
      rentByTenant[key].push(rc);
    }

    const tenants = beds
      .filter((b) => b.tenantUserId && b.pgId)
      .map((bed) => {
        const t = bed.tenantUserId;
        const key = String(t._id);
        const cycles = (rentByTenant[key] || []).sort(
          (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        );
        const nextDue = cycles.find((c) => c.status === "DUE" || c.status === "OVERDUE") || null;
        const overdueCount = cycles.filter((c) => c.status === "OVERDUE").length;
        return {
          tenant: {
            _id: t._id,
            name: t.name,
            phone: t.phone,
            email: t.email,
            gender: t.gender,
            status: t.status,
            profession: t.profession,
            address: t.address,
            emergencyContactName: t.emergencyContactName,
            emergencyContactPhone: t.emergencyContactPhone,
            createdAt: t.createdAt,
          },
          pg: { _id: bed.pgId._id, name: bed.pgId.name, city: bed.pgId.city },
          bed: {
            _id: bed._id,
            roomNo: bed.roomNo,
            bedNo: bed.bedNo,
            sharingType: bed.sharingType,
            priceMonthly: bed.priceMonthly,
            status: bed.status,
          },
          rent: nextDue
            ? {
                monthKey: nextDue.monthKey,
                dueDate: nextDue.dueDate,
                amount: nextDue.amount,
                status: nextDue.status,
                overdueCount,
              }
            : { monthKey: "", dueDate: null, amount: bed.priceMonthly, status: "DUE", overdueCount },
        };
      });

    return res.json({ tenants });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tenants", error: error.message });
  }
}

async function getOwnerTenantDetail(req, res) {
  try {
    const ownerId = req.user.userId;
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
    if (!pgIds.length) return res.status(404).json({ message: "No properties found" });

    const bed = await Bed.findOne({
      pgId: { $in: pgIds },
      tenantUserId: userId,
      status: { $in: ["OCCUPIED", "LEAVING"] },
    })
      .populate({ path: "pgId", select: "name city address propertyType" })
      .lean();

    const hasAnyBooking = await Booking.exists({ userId, pgId: { $in: pgIds } });
    if (!bed && !hasAnyBooking) {
      return res.status(404).json({ message: "Tenant not found in your properties" });
    }

    const [tenant, bookings, payments, tickets, rentCycles, tenantDocs] = await Promise.all([
      User.findById(userId)
        .select(
          "name phone email gender status createdAt profession address emergencyContactName emergencyContactPhone"
        )
        .lean(),
      Booking.find({ userId, pgId: { $in: pgIds } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({ path: "pgId", select: "name city" })
        .populate({ path: "bedId", select: "roomNo bedNo priceMonthly status sharingType" })
        .lean(),
      Payment.find({ userId, ownerId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Ticket.find({ userId, pgId: { $in: pgIds } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({ path: "pgId", select: "name city" })
        .lean(),
      RentCycle.find({ tenantUserId: userId })
        .sort({ dueDate: 1 })
        .limit(24)
        .populate({ path: "bedId", select: "roomNo bedNo pgId priceMonthly" })
        .lean(),
      User.findById(userId).select("tenantDocuments").lean(),
    ]);

    const joinedAt = bookings.length ? bookings[bookings.length - 1].createdAt : null;
    const due = rentCycles.filter((r) => r.status === "DUE" || r.status === "OVERDUE");

    return res.json({
      tenant,
      joinedAt,
      tenantDocuments: (tenantDocs?.tenantDocuments || []).map((d) => ({
        fileId: d.fileId,
        kind: d.kind,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt,
      })),
      currentStay: bed
        ? {
            pg: bed.pgId
              ? {
                  _id: bed.pgId._id,
                  name: bed.pgId.name,
                  city: bed.pgId.city,
                  address: bed.pgId.address,
                  propertyType: bed.pgId.propertyType,
                }
              : null,
            bed: {
              _id: bed._id,
              roomNo: bed.roomNo,
              bedNo: bed.bedNo,
              status: bed.status,
              priceMonthly: bed.priceMonthly,
              sharingType: bed.sharingType,
            },
          }
        : null,
      rent: {
        overdueCount: due.filter((r) => r.status === "OVERDUE").length,
        nextDue: due.length ? due[0] : null,
        cycles: rentCycles,
      },
      payments,
      tickets,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tenant", error: error.message });
  }
}

async function listOwnerUpcomingMoveIns(req, res) {
  try {
    const ownerId = req.user.userId;
    const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
    if (!pgIds.length) return res.json({ upcoming: [] });

    const now = new Date();
    const upcoming = await Booking.find({
      pgId: { $in: pgIds },
      bookingType: "TOKEN",
      status: "PENDING",
      lockExpiresAt: { $gt: now },
    })
      .populate({ path: "userId", select: "name phone email" })
      .populate({ path: "bedId", select: "roomNo bedNo priceMonthly status" })
      .populate({ path: "pgId", select: "name city" })
      .sort({ lockExpiresAt: 1 })
      .limit(50)
      .lean();

    return res.json({ upcoming });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load upcoming move-ins", error: error.message });
  }
}

module.exports = {
  ensureOwnerPg,
  getOwnerProfile,
  patchOwnerProfile,
  patchOwnerAccount,
  changeOwnerPassword,
  listOwnerProperties,
  getOwnerPropertyDetail,
  updateOwnerProperty,
  listOwnerBookings,
  listOwnerTickets,
  listOwnerPayouts,
  listOwnerTenants,
  getOwnerTenantDetail,
  listOwnerUpcomingMoveIns,
};
