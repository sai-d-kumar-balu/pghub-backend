const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pgId: { type: mongoose.Schema.Types.ObjectId, ref: "PgProperty", required: true },
    bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", required: true },
    bookingType: { type: String, enum: ["ENQUIRY", "TOKEN", "FULL"], default: "TOKEN" },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"],
      default: "PENDING",
    },
    amount: { type: Number, default: 999 },
    lockExpiresAt: { type: Date },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
