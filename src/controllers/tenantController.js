const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const PgProperty = require("../models/PgProperty");
const Bed = require("../models/Bed");

async function ensureUserBooking(req, bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) {
    return { err: { status: 400, message: "Invalid booking id" } };
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { err: { status: 404, message: "Booking not found" } };
  }
  if (String(booking.userId) !== String(req.user.userId)) {
    return { err: { status: 403, message: "Forbidden" } };
  }
  return { booking };
}

async function ensureUserTicket(req, ticketId) {
  if (!mongoose.isValidObjectId(ticketId)) {
    return { err: { status: 400, message: "Invalid ticket id" } };
  }
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return { err: { status: 404, message: "Ticket not found" } };
  }
  if (String(ticket.userId) !== String(req.user.userId)) {
    return { err: { status: 403, message: "Forbidden" } };
  }
  return { ticket };
}

async function patchTenantProfile(req, res) {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      name,
      email,
      gender,
      profession,
      address,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string") {
      const next = email.trim().toLowerCase() || undefined;
      if (next) {
        const taken = await User.findOne({ email: next, _id: { $ne: userId } });
        if (taken) {
          return res.status(409).json({ message: "Email already in use" });
        }
      }
      user.email = next;
    }
    if (gender && ["MALE", "FEMALE", "OTHER"].includes(gender)) {
      user.gender = gender;
    }
    if (typeof profession === "string") user.profession = profession.trim() || undefined;
    if (typeof address === "string") user.address = address.trim() || undefined;
    if (typeof emergencyContactName === "string") {
      user.emergencyContactName = emergencyContactName.trim() || undefined;
    }
    if (typeof emergencyContactPhone === "string") {
      user.emergencyContactPhone = emergencyContactPhone.trim() || undefined;
    }

    await user.save();
    return res.json({
      message: "Profile updated",
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        profession: user.profession,
        address: user.address,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
}

async function changeTenantPassword(req, res) {
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

async function listTenantBookings(req, res) {
  try {
    const userId = req.user.userId;
    const bookings = await Booking.find({ userId })
      .populate({ path: "pgId", select: "name city address verified" })
      .populate({ path: "bedId", select: "roomNo bedNo priceMonthly status sharingType" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ bookings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list bookings", error: error.message });
  }
}

async function getTenantBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const { err, booking } = await ensureUserBooking(req, bookingId);
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const [pg, bed, payment] = await Promise.all([
      PgProperty.findById(booking.pgId).select("name city address propertyType foodMenu").lean(),
      Bed.findById(booking.bedId).lean(),
      Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean(),
    ]);

    return res.json({
      booking: booking.toObject(),
      pg,
      bed,
      payment,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load booking", error: error.message });
  }
}

async function listTenantPayments(req, res) {
  try {
    const userId = req.user.userId;
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .populate({ path: "bookingId", select: "status bookingType pgId bedId" })
      .lean();

    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list payments", error: error.message });
  }
}

async function listTenantTickets(req, res) {
  try {
    const userId = req.user.userId;
    const tickets = await Ticket.find({ userId })
      .populate({ path: "pgId", select: "name city" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ tickets });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list tickets", error: error.message });
  }
}

async function getTenantTicket(req, res) {
  try {
    const { ticketId } = req.params;
    const { err, ticket } = await ensureUserTicket(req, ticketId);
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const pg = await PgProperty.findById(ticket.pgId).select("name city address").lean();
    return res.json({ ticket: ticket.toObject(), pg });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load ticket", error: error.message });
  }
}

async function createTenantTicket(req, res) {
  try {
    const userId = req.user.userId;
    const { pgId, type, description } = req.body;

    if (!mongoose.isValidObjectId(pgId)) {
      return res.status(400).json({ message: "Valid pgId required" });
    }
    if (!type || !["COMPLAINT", "VACATE", "REFUND"].includes(type)) {
      return res.status(400).json({ message: "type must be COMPLAINT, VACATE, or REFUND" });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: "description required" });
    }

    const pg = await PgProperty.findById(pgId);
    if (!pg) {
      return res.status(404).json({ message: "PG not found" });
    }

    const hasBooking = await Booking.exists({ userId, pgId });
    if (!hasBooking) {
      return res.status(403).json({
        message: "You can only raise tickets for properties you have booked.",
      });
    }

    const ticket = await Ticket.create({
      userId,
      pgId,
      type,
      description: String(description).trim(),
      status: "OPEN",
    });

    return res.status(201).json({ message: "Ticket created", ticket });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create ticket", error: error.message });
  }
}

/** PGs the tenant has bookings for — for ticket form dropdown */
async function listTenantPgContext(req, res) {
  try {
    const userId = req.user.userId;
    const bookings = await Booking.find({ userId }).select("pgId").lean();
    const ids = [...new Set(bookings.map((b) => String(b.pgId)))];
    const pgs = await PgProperty.find({ _id: { $in: ids } })
      .select("name city address")
      .sort({ name: 1 })
      .lean();

    return res.json({ pgs });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load context", error: error.message });
  }
}

module.exports = {
  patchTenantProfile,
  changeTenantPassword,
  listTenantBookings,
  getTenantBooking,
  listTenantPayments,
  listTenantTickets,
  getTenantTicket,
  createTenantTicket,
  listTenantPgContext,
};
