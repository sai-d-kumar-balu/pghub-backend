const Bed = require("../models/Bed");
const Booking = require("../models/Booking");
const OwnerProfile = require("../models/OwnerProfile");
const Payment = require("../models/Payment");
const PgProperty = require("../models/PgProperty");
const RentCycle = require("../models/RentCycle");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const SavedPaymentMethod = require("../models/SavedPaymentMethod");

async function getOwnerDashboard(req, res) {
  try {
    const ownerId = req.user.userId;
    const ownerPgIds = await PgProperty.find({ ownerId }).distinct("_id");
    const now = new Date();

    const [properties, beds, bookings, payments, tickets, profile, blocked48hBookings] = await Promise.all([
      PgProperty.find({ ownerId }).sort({ createdAt: -1 }).lean(),
      Bed.find({ pgId: { $in: ownerPgIds } }).lean(),
      Booking.find({ pgId: { $in: ownerPgIds } }).sort({ createdAt: -1 }).limit(8).lean(),
      Payment.find({ ownerId }).sort({ createdAt: -1 }).limit(8).lean(),
      Ticket.find({ pgId: { $in: ownerPgIds } }).sort({ createdAt: -1 }).limit(8).lean(),
      OwnerProfile.findOne({ userId: ownerId }).lean(),
      Booking.find({
        pgId: { $in: ownerPgIds },
        bookingType: "TOKEN",
        status: "PENDING",
        lockExpiresAt: { $gt: now },
      })
        .populate({ path: "userId", select: "name phone email" })
        .populate({ path: "bedId", select: "roomNo bedNo priceMonthly status" })
        .populate({ path: "pgId", select: "name city" })
        .sort({ lockExpiresAt: 1 })
        .limit(20)
        .lean(),
    ]);

    const occupiedBeds = beds.filter((bed) => bed.status === "OCCUPIED").length;
    const vacantBeds = beds.filter((bed) => bed.status === "VACANT").length;
    const blockedBeds = beds.filter((bed) => bed.status === "BLOCKED").length;
    const totalBeds = beds.length;
    const occupancyPct = totalBeds ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

    const payoutsIncoming = payments
      .filter((payment) => payment.status === "SUCCESS")
      .reduce((sum, payment) => sum + (payment.ownerPayout || 0), 0);
    const platformFeePaid = payments
      .filter((payment) => payment.status === "SUCCESS")
      .reduce((sum, payment) => sum + (payment.platformFee || 0), 0);

    const unverifiedPropertyCount = properties.filter((p) => !p.verified).length;
    const openTicketCount = tickets.filter(
      (t) => t.status !== "RESOLVED" && t.status !== "REJECTED"
    ).length;

    return res.json({
      summary: {
        properties: properties.length,
        totalBeds,
        occupiedBeds,
        vacantBeds,
        blockedBeds,
        occupancyPct,
        payoutsIncoming,
        platformFeePaid,
        commissionPct: profile?.commissionPct ?? 10,
        blocked48hUsers: blocked48hBookings.length,
      },
      alerts: {
        kycPending: profile?.kycStatus === "PENDING",
        kycRejected: profile?.kycStatus === "REJECTED",
        unverifiedPropertyCount,
        openTicketCount,
      },
      ownerProfile: profile
        ? {
            kycStatus: profile.kycStatus,
            commissionPct: profile.commissionPct,
            kycReviewNotes: profile.kycReviewNotes,
          }
        : null,
      properties: properties.map((property) => ({
        _id: property._id,
        name: property.name,
        city: property.city,
        verified: property.verified,
        status: property.status,
      })),
      recentBookings: bookings,
      recentPayments: payments,
      recentTickets: tickets,
      blocked48hBookings: blocked48hBookings.map((item) => ({
        _id: item._id,
        bookingId: item._id,
        amount: item.amount,
        lockExpiresAt: item.lockExpiresAt,
        createdAt: item.createdAt,
        user: item.userId
          ? {
              name: item.userId.name,
              phone: item.userId.phone,
              email: item.userId.email,
            }
          : null,
        bed: item.bedId
          ? {
              roomNo: item.bedId.roomNo,
              bedNo: item.bedId.bedNo,
              priceMonthly: item.bedId.priceMonthly,
              status: item.bedId.status,
            }
          : null,
        pg: item.pgId
          ? {
              name: item.pgId.name,
              city: item.pgId.city,
            }
          : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load owner dashboard", error: error.message });
  }
}

async function getAdminDashboard(_req, res) {
  try {
    const [
      users,
      owners,
      pgs,
      beds,
      bookings,
      payments,
      tickets,
      rentCycles,
      blockedUsers,
      openTicketsCount,
      paymentTotals,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "OWNER" }),
      PgProperty.countDocuments(),
      Bed.find().lean(),
      Booking.find().sort({ createdAt: -1 }).limit(10).lean(),
      Payment.find().sort({ createdAt: -1 }).limit(10).lean(),
      Ticket.find().sort({ createdAt: -1 }).limit(10).lean(),
      RentCycle.find().sort({ dueDate: 1 }).limit(10).lean(),
      User.find({ status: "BLOCKED" })
        .select("name phone email role status createdAt updatedAt")
        .sort({ updatedAt: -1 })
        .lean(),
      Ticket.countDocuments({ status: { $nin: ["RESOLVED", "REJECTED"] } }),
      Payment.aggregate([
        { $match: { status: "SUCCESS" } },
        {
          $group: {
            _id: null,
            totalSuccessfulPayments: { $sum: "$totalAmount" },
            totalPlatformFees: { $sum: "$platformFee" },
          },
        },
      ]),
    ]);

    const bedStatus = beds.reduce(
      (acc, bed) => {
        acc[bed.status] = (acc[bed.status] || 0) + 1;
        return acc;
      },
      { VACANT: 0, BLOCKED: 0, OCCUPIED: 0, LEAVING: 0 }
    );

    const totals = paymentTotals[0] || { totalSuccessfulPayments: 0, totalPlatformFees: 0 };
    return res.json({
      summary: {
        users,
        owners,
        properties: pgs,
        totalBeds: beds.length,
        bedStatus,
        totalSuccessfulPayments: totals.totalSuccessfulPayments || 0,
        totalPlatformFees: totals.totalPlatformFees || 0,
        openTickets: openTicketsCount,
        blockedUsers: blockedUsers.length,
      },
      recentBookings: bookings,
      recentPayments: payments,
      recentTickets: tickets,
      dueRentCycles: rentCycles,
      blockedUsers,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load admin dashboard", error: error.message });
  }
}

async function getUserDashboard(req, res) {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [user, bookings, payments, tickets, paymentMethods, rentCycles] = await Promise.all([
      User.findById(userId)
        .select(
          "name phone email gender role status createdAt profession address emergencyContactName emergencyContactPhone"
        )
        .lean(),
      Booking.find({ userId })
        .populate({ path: "pgId", select: "name city" })
        .populate({ path: "bedId", select: "roomNo bedNo priceMonthly" })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Payment.find({ userId }).sort({ createdAt: -1 }).limit(12).lean(),
      Ticket.find({ userId }).sort({ createdAt: -1 }).limit(8).lean(),
      SavedPaymentMethod.find({ userId, status: "ACTIVE" }).sort({ isDefault: -1, createdAt: -1 }).lean(),
      RentCycle.find({ tenantUserId: userId })
        .sort({ dueDate: 1 })
        .limit(6)
        .populate({ path: "bedId", select: "roomNo bedNo pgId" })
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeBlocks = bookings.filter(
      (booking) =>
        booking.bookingType === "TOKEN" &&
        booking.status === "PENDING" &&
        booking.lockExpiresAt &&
        new Date(booking.lockExpiresAt) > now
    );
    const blockExpiringSoon = activeBlocks.some(
      (b) => b.lockExpiresAt && new Date(b.lockExpiresAt) <= soon
    );
    const successfulPayments = payments.filter((payment) => payment.status === "SUCCESS");
    const totalPaid = successfulPayments.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
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
    const openTickets = tickets.filter(
      (ticket) => ticket.status !== "RESOLVED" && ticket.status !== "REJECTED"
    ).length;
    const overdueRent = rentCycles.filter((r) => r.status === "OVERDUE").length;
    const dueRentSoon = rentCycles.filter(
      (r) => r.status === "DUE" && r.dueDate && new Date(r.dueDate) <= soon
    ).length;

    return res.json({
      profile: user,
      summary: {
        totalBookings: bookings.length,
        activeBlocks: activeBlocks.length,
        successfulPayments: successfulPayments.length,
        totalPaid,
        openTickets,
        profileCompletionPct,
      },
      alerts: {
        profileIncomplete: profileCompletionPct < 100,
        blockExpiringSoon: blockExpiringSoon && activeBlocks.length > 0,
        openTickets,
        overdueRent,
        dueRentSoon,
      },
      bookings,
      payments,
      tickets,
      paymentMethods,
      rentCycles,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load user dashboard", error: error.message });
  }
}

module.exports = { getOwnerDashboard, getAdminDashboard, getUserDashboard };
