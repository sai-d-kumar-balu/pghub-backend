const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paymentType: { type: String, enum: ["TOKEN", "RENT", "DEPOSIT"], default: "TOKEN" },
    totalAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    ownerPayout: { type: Number, required: true },
    status: { type: String, enum: ["CREATED", "SUCCESS", "FAILED", "REFUNDED"], default: "CREATED" },
    gatewayRef: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
