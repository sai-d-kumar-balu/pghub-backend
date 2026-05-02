const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const Bed = require("../models/Bed");
const Booking = require("../models/Booking");
const OwnerProfile = require("../models/OwnerProfile");
const Payment = require("../models/Payment");
const PgProperty = require("../models/PgProperty");
const PlatformConfig = require("../models/PlatformConfig");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const SavedPaymentMethod = require("../models/SavedPaymentMethod");

async function writeAudit(req, entityType, entityId, action, before, after) {
  await AuditLog.create({
    actorUserId: req.user.userId,
    actorRole: req.user.role,
    entityType,
    entityId: String(entityId),
    action,
    before: before ?? null,
    after: after ?? null,
  });
}

function mapProfileToKycItem(profile, { includeDocuments }) {
  if (!profile || !profile.userId) return null;
  const u = profile.userId;
  const docs = profile.kycDocuments || [];
  const item = {
    userId: u._id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    userStatus: u.status,
    kycStatus: profile.kycStatus,
    pan: profile.pan,
    aadhaar: profile.aadhaar,
    gstNumber: profile.gstNumber,
    bankDetails: profile.bankDetails,
    commissionPct: profile.commissionPct,
    kycReviewNotes: profile.kycReviewNotes,
    documentCount: docs.length,
    updatedAt: profile.updatedAt,
  };
  if (includeDocuments) {
    item.kycDocuments = docs.map((d) => ({
      fileId: d.fileId,
      kind: d.kind,
      originalName: d.originalName,
      mimeType: d.mimeType,
      size: d.size,
      uploadedAt: d.uploadedAt,
    }));
  }
  return item;
}

async function listKycQueue(_req, res) {
  try {
    const profiles = await OwnerProfile.find()
      .populate({ path: "userId", select: "name phone email role status createdAt" })
      .sort({ updatedAt: -1 })
      .lean();

    const items = profiles
      .map((p) => mapProfileToKycItem(p, { includeDocuments: false }))
      .filter(Boolean);

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load KYC queue", error: error.message });
  }
}

async function getKycOwnerDetail(req, res) {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const owner = await User.findById(userId).lean();
    if (!owner || owner.role !== "OWNER") {
      return res.status(404).json({ message: "Owner not found" });
    }

    const profile = await OwnerProfile.findOne({ userId })
      .populate({ path: "userId", select: "name phone email role status createdAt" })
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Owner profile not found" });
    }

    const item = mapProfileToKycItem(profile, { includeDocuments: true });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load KYC detail", error: error.message });
  }
}

async function updateKyc(req, res) {
  try {
    const { userId } = req.params;
    const { kycStatus, kycReviewNotes } = req.body;
    if (!["VERIFIED", "REJECTED", "PENDING"].includes(kycStatus)) {
      return res.status(400).json({ message: "Invalid kycStatus" });
    }

    const profile = await OwnerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Owner profile not found" });
    }

    const owner = await User.findById(userId);
    if (!owner || owner.role !== "OWNER") {
      return res.status(400).json({ message: "User is not an owner" });
    }

    const before = { kycStatus: profile.kycStatus, kycReviewNotes: profile.kycReviewNotes };
    profile.kycStatus = kycStatus;
    if (typeof kycReviewNotes === "string") profile.kycReviewNotes = kycReviewNotes;
    await profile.save();

    await writeAudit(req, "OwnerProfile", profile._id, "KYC_UPDATE", before, {
      kycStatus: profile.kycStatus,
      kycReviewNotes: profile.kycReviewNotes,
    });

    return res.json({
      message: "KYC updated",
      profile: profile.toObject(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update KYC", error: error.message });
  }
}

async function listPropertiesAdmin(req, res) {
  try {
    const { verified, city } = req.query;
    const filter = {};
    if (verified === "true") filter.verified = true;
    if (verified === "false") filter.verified = false;
    if (city) filter.city = new RegExp(String(city), "i");

    const items = await PgProperty.find(filter)
      .populate({ path: "ownerId", select: "name phone email" })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      items: items.map((p) => ({
        _id: p._id,
        name: p.name,
        city: p.city,
        address: p.address,
        propertyType: p.propertyType,
        verified: p.verified,
        status: p.status,
        owner: p.ownerId
          ? { name: p.ownerId.name, phone: p.ownerId.phone, email: p.ownerId.email, _id: p.ownerId._id }
          : null,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load properties", error: error.message });
  }
}

async function updatePropertyAdmin(req, res) {
  try {
    const property = await PgProperty.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const { verified, status } = req.body;
    const before = { verified: property.verified, status: property.status };

    if (typeof verified === "boolean") property.verified = verified;
    if (status && ["ACTIVE", "INACTIVE"].includes(status)) property.status = status;

    await property.save();
    await writeAudit(req, "PgProperty", property._id, "ADMIN_PROPERTY_UPDATE", before, {
      verified: property.verified,
      status: property.status,
    });

    return res.json({ message: "Property updated", property });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update property", error: error.message });
  }
}

async function listBedsAdmin(req, res) {
  try {
    const { pgId, status, city } = req.query;
    const filter = {};
    if (pgId && mongoose.isValidObjectId(pgId)) filter.pgId = pgId;
    if (status) filter.status = status;

    let beds = await Bed.find(filter).populate({ path: "pgId", select: "name city ownerId" }).sort({ updatedAt: -1 }).limit(200).lean();

    if (city) {
      const re = new RegExp(String(city), "i");
      beds = beds.filter((b) => b.pgId && re.test(b.pgId.city || ""));
    }

    return res.json({
      items: beds.map((b) => ({
        _id: b._id,
        roomNo: b.roomNo,
        bedNo: b.bedNo,
        status: b.status,
        priceMonthly: b.priceMonthly,
        tenantUserId: b.tenantUserId,
        lockExpiresAt: b.lockExpiresAt,
        pg: b.pgId
          ? {
              _id: b.pgId._id,
              name: b.pgId.name,
              city: b.pgId.city,
              ownerId: b.pgId.ownerId,
            }
          : null,
        updatedAt: b.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load beds", error: error.message });
  }
}

function mapBedForInventory(bed) {
  return {
    _id: bed._id,
    bedNo: bed.bedNo,
    status: bed.status,
    priceMonthly: bed.priceMonthly,
    sharingType: bed.sharingType,
    genderTag: bed.genderTag,
    ac: bed.ac,
    attachedBath: bed.attachedBath,
    tenantUserId: bed.tenantUserId,
    lockExpiresAt: bed.lockExpiresAt,
    updatedAt: bed.updatedAt,
  };
}

async function listInventoryAdmin(req, res) {
  try {
    const { city, pgId } = req.query;
    const pgFilter = {};
    if (pgId && mongoose.isValidObjectId(pgId)) {
      pgFilter._id = pgId;
    } else if (city && String(city).trim()) {
      pgFilter.city = new RegExp(String(city).trim(), "i");
    }

    const pgs = await PgProperty.find(pgFilter).sort({ city: 1, name: 1 }).lean();
    if (!pgs.length) {
      return res.json({ properties: [] });
    }

    const pgIds = pgs.map((p) => p._id);
    const allBeds = await Bed.find({ pgId: { $in: pgIds } })
      .sort({ roomNo: 1, bedNo: 1 })
      .lean();

    const bedsByPgId = {};
    for (const bed of allBeds) {
      const key = String(bed.pgId);
      if (!bedsByPgId[key]) bedsByPgId[key] = [];
      bedsByPgId[key].push(bed);
    }

    const properties = pgs.map((pg) => {
      const beds = bedsByPgId[String(pg._id)] || [];
      const roomMap = {};
      for (const bed of beds) {
        const rn = bed.roomNo;
        if (!roomMap[rn]) roomMap[rn] = [];
        roomMap[rn].push(mapBedForInventory(bed));
      }

      const roomNos = Object.keys(roomMap).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
      const rooms = roomNos.map((roomNo) => ({
        roomNo,
        beds: roomMap[roomNo].sort((a, b) =>
          a.bedNo.localeCompare(b.bedNo, undefined, { numeric: true, sensitivity: "base" })
        ),
      }));

      return {
        _id: pg._id,
        name: pg.name,
        city: pg.city,
        address: pg.address,
        propertyType: pg.propertyType,
        verified: pg.verified,
        status: pg.status,
        rooms,
        bedCount: beds.length,
      };
    });

    return res.json({ properties });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load inventory", error: error.message });
  }
}

async function updateBedAdmin(req, res) {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      return res.status(404).json({ message: "Bed not found" });
    }

    const { status, clearTenant } = req.body;
    if (!status || !["VACANT", "BLOCKED", "OCCUPIED", "LEAVING"].includes(status)) {
      return res.status(400).json({ message: "Invalid bed status" });
    }

    const before = {
      status: bed.status,
      tenantUserId: bed.tenantUserId,
      lockExpiresAt: bed.lockExpiresAt,
    };

    bed.status = status;
    if (clearTenant || status === "VACANT") {
      bed.tenantUserId = null;
      bed.lockExpiresAt = null;
    }

    await bed.save();
    await writeAudit(req, "Bed", bed._id, "ADMIN_BED_OVERRIDE", before, {
      status: bed.status,
      tenantUserId: bed.tenantUserId,
      lockExpiresAt: bed.lockExpiresAt,
    });

    return res.json({ message: "Bed updated", bed });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update bed", error: error.message });
  }
}

async function listOwnerCommissions(_req, res) {
  try {
    const profiles = await OwnerProfile.find()
      .populate({ path: "userId", select: "name phone email status" })
      .sort({ updatedAt: -1 })
      .lean();

    const items = profiles
      .filter((p) => p.userId)
      .map((p) => ({
        userId: p.userId._id,
        name: p.userId.name,
        phone: p.userId.phone,
        email: p.userId.email,
        userStatus: p.userId.status,
        kycStatus: p.kycStatus,
        commissionPct: p.commissionPct,
      }));

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load commissions", error: error.message });
  }
}

async function updateOwnerCommission(req, res) {
  try {
    const { userId } = req.params;
    const { commissionPct } = req.body;
    if (typeof commissionPct !== "number" || commissionPct < 0 || commissionPct > 100) {
      return res.status(400).json({ message: "commissionPct must be 0-100" });
    }

    const profile = await OwnerProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: "Owner profile not found" });
    }

    const before = { commissionPct: profile.commissionPct };
    profile.commissionPct = commissionPct;
    await profile.save();

    await writeAudit(req, "OwnerProfile", profile._id, "COMMISSION_UPDATE", before, {
      commissionPct: profile.commissionPct,
    });

    return res.json({ message: "Commission updated", commissionPct: profile.commissionPct });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update commission", error: error.message });
  }
}

async function listPaymentsAdmin(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const items = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "userId", select: "name phone" })
      .populate({ path: "ownerId", select: "name phone" })
      .lean();

    return res.json({
      items: items.map((p) => ({
        _id: p._id,
        paymentType: p.paymentType,
        status: p.status,
        totalAmount: p.totalAmount,
        platformFee: p.platformFee,
        ownerPayout: p.ownerPayout,
        gatewayRef: p.gatewayRef,
        createdAt: p.createdAt,
        user: p.userId ? { name: p.userId.name, phone: p.userId.phone } : null,
        owner: p.ownerId ? { name: p.ownerId.name, phone: p.ownerId.phone } : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load payments", error: error.message });
  }
}

async function listDisputes(req, res) {
  try {
    const scope = req.query.scope === "all" ? "all" : "open";
    const statusFilter =
      scope === "all" ? {} : { status: { $in: ["OPEN", "IN_PROGRESS"] } };
    const items = await Ticket.find({
      type: { $in: ["REFUND", "COMPLAINT", "VACATE"] },
      ...statusFilter,
    })
      .sort({ createdAt: -1 })
      .populate({ path: "userId", select: "name phone email" })
      .populate({ path: "pgId", select: "name city" })
      .limit(100)
      .lean();

    return res.json({
      items: items.map((t) => ({
        _id: t._id,
        type: t.type,
        status: t.status,
        description: t.description,
        resolution: t.resolution,
        createdAt: t.createdAt,
        user: t.userId
          ? { name: t.userId.name, phone: t.userId.phone, email: t.userId.email, _id: t.userId._id }
          : null,
        pg: t.pgId ? { name: t.pgId.name, city: t.pgId.city, _id: t.pgId._id } : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load disputes", error: error.message });
  }
}

async function updateTicketAdmin(req, res) {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const { status, resolution } = req.body;
    if (status && !["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const before = { status: ticket.status, resolution: ticket.resolution };
    if (status) ticket.status = status;
    if (typeof resolution === "string") ticket.resolution = resolution;

    await ticket.save();
    await writeAudit(req, "Ticket", ticket._id, "TICKET_UPDATE", before, {
      status: ticket.status,
      resolution: ticket.resolution,
    });

    return res.json({ message: "Ticket updated", ticket });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update ticket", error: error.message });
  }
}

async function listUsersAdmin(req, res) {
  try {
    const { status, role } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;

    const items = await User.find(filter)
      .select("name phone email role status createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load users", error: error.message });
  }
}

async function getUserAdminDetail(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select("-passwordHash").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    const [
      bookingCount,
      paymentCount,
      openTickets,
      recentBookings,
      recentPayments,
      paymentMethods,
    ] = await Promise.all([
      Booking.countDocuments({ userId: id }),
      Payment.countDocuments({ userId: id }),
      Ticket.countDocuments({ userId: id, status: { $nin: ["RESOLVED", "REJECTED"] } }),
      Booking.find({ userId: id })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate({ path: "pgId", select: "name city" })
        .populate({ path: "bedId", select: "roomNo bedNo priceMonthly" })
        .lean(),
      Payment.find({ userId: id }).sort({ createdAt: -1 }).limit(8).lean(),
      SavedPaymentMethod.find({ userId: id, status: "ACTIVE" })
        .sort({ isDefault: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    const activeBlocks = (
      await Booking.find({
        userId: id,
        bookingType: "TOKEN",
        status: "PENDING",
        lockExpiresAt: { $gt: now },
      })
        .select("_id")
        .limit(50)
        .lean()
    ).length;

    let ownerProfile = null;
    if (user.role === "OWNER") {
      const op = await OwnerProfile.findOne({ userId: id })
        .select("kycStatus commissionPct pan gstNumber kycReviewNotes kycDocuments")
        .lean();
      if (op) {
        ownerProfile = {
          kycStatus: op.kycStatus,
          commissionPct: op.commissionPct,
          pan: op.pan,
          gstNumber: op.gstNumber,
          kycReviewNotes: op.kycReviewNotes,
          documentCount: (op.kycDocuments || []).length,
        };
      }
    }

    const successfulPayments = await Payment.countDocuments({ userId: id, status: "SUCCESS" });
    const totalPaidAgg = await Payment.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(id), status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const totalPaid = totalPaidAgg[0]?.total || 0;

    const completionParts = [
      user.email,
      user.address,
      user.profession,
      user.emergencyContactName,
      user.emergencyContactPhone,
    ];
    const profileCompletionPct = Math.round(
      (completionParts.filter(Boolean).length / completionParts.length) * 100
    );

    return res.json({
      user,
      summary: {
        bookingCount,
        paymentCount,
        openTickets,
        activeBlocks,
        successfulPayments,
        totalPaid,
        profileCompletionPct,
      },
      recentBookings,
      recentPayments,
      paymentMethods,
      ownerProfile,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load user", error: error.message });
  }
}

async function updateUserAdmin(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "ADMIN") {
      return res.status(400).json({ message: "Cannot change admin user this way" });
    }

    const { status } = req.body;
    if (!status || !["ACTIVE", "BLOCKED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const before = { status: user.status };
    user.status = status;
    await user.save();

    await writeAudit(req, "User", user._id, "USER_STATUS", before, { status: user.status });

    return res.json({ message: "User updated", user: { _id: user._id, status: user.status } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user", error: error.message });
  }
}

async function listAuditLogs(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 80, 300);
    const items = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "actorUserId", select: "name phone role" })
      .lean();

    return res.json({
      items: items.map((a) => ({
        _id: a._id,
        actorRole: a.actorRole,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        before: a.before,
        after: a.after,
        createdAt: a.createdAt,
        actor: a.actorUserId
          ? { name: a.actorUserId.name, phone: a.actorUserId.phone, role: a.actorUserId.role }
          : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load audit log", error: error.message });
  }
}

async function getPlatformConfig(_req, res) {
  try {
    const docs = await PlatformConfig.find().sort({ key: 1 }).lean();
    const map = {};
    docs.forEach((d) => {
      map[d.key] = d.value;
    });
    return res.json({ settings: map, rows: docs });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load config", error: error.message });
  }
}

async function putPlatformConfig(req, res) {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ message: "settings object required" });
    }

    const keys = Object.keys(settings);
    for (const key of keys) {
      await PlatformConfig.findOneAndUpdate(
        { key },
        { key, value: settings[key], updatedBy: req.user.userId },
        { upsert: true, new: true }
      );
    }

    await writeAudit(req, "PlatformConfig", "bulk", "CONFIG_UPDATE", null, { keys });

    const docs = await PlatformConfig.find().sort({ key: 1 }).lean();
    const map = {};
    docs.forEach((d) => {
      map[d.key] = d.value;
    });
    return res.json({ message: "Config saved", settings: map });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save config", error: error.message });
  }
}

async function getReports(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      paymentsThisMonth,
      successfulAllTime,
      bookingsByStatus,
      ticketsByStatus,
      ownersVerified,
      ownersPendingKyc,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "SUCCESS", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, fees: { $sum: "$platformFee" } } },
      ]),
      Payment.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      OwnerProfile.countDocuments({ kycStatus: "VERIFIED" }),
      OwnerProfile.countDocuments({ kycStatus: "PENDING" }),
    ]);

    const month = paymentsThisMonth[0] || { total: 0, fees: 0 };
    const all = successfulAllTime[0] || { total: 0, count: 0 };

    return res.json({
      paymentsThisMonth: { gmv: month.total || 0, platformFees: month.fees || 0 },
      paymentsAllTime: { gmv: all.total || 0, successfulCount: all.count || 0 },
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b._id, b.count])),
      ticketsByStatus: Object.fromEntries(ticketsByStatus.map((b) => [b._id, b.count])),
      kyc: { verifiedOwners: ownersVerified, pendingKyc: ownersPendingKyc },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to build reports", error: error.message });
  }
}

module.exports = {
  listKycQueue,
  getKycOwnerDetail,
  updateKyc,
  listPropertiesAdmin,
  updatePropertyAdmin,
  listBedsAdmin,
  listInventoryAdmin,
  updateBedAdmin,
  listOwnerCommissions,
  updateOwnerCommission,
  listPaymentsAdmin,
  listDisputes,
  updateTicketAdmin,
  listUsersAdmin,
  getUserAdminDetail,
  updateUserAdmin,
  listAuditLogs,
  getPlatformConfig,
  putPlatformConfig,
  getReports,
};
