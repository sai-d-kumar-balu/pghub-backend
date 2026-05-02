const mongoose = require("mongoose");

const savedPaymentMethodSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    brand: { type: String, enum: ["VISA", "MASTERCARD", "RUPAY", "UPI"], default: "VISA" },
    holderName: { type: String, trim: true },
    last4: { type: String, required: true, trim: true },
    expiryMonth: { type: Number, min: 1, max: 12 },
    expiryYear: { type: Number },
    upiId: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SavedPaymentMethod", savedPaymentMethodSchema);
