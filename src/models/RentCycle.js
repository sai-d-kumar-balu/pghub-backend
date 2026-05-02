const mongoose = require("mongoose");

const rentCycleSchema = new mongoose.Schema(
  {
    bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", required: true },
    tenantUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    monthKey: { type: String, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["DUE", "PAID", "OVERDUE"], default: "DUE" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rentCycleSchema.index({ bedId: 1, tenantUserId: 1, monthKey: 1 }, { unique: true });

module.exports = mongoose.model("RentCycle", rentCycleSchema);
