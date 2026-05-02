const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema(
  {
    pgId: { type: mongoose.Schema.Types.ObjectId, ref: "PgProperty", required: true, index: true },
    roomNo: { type: String, required: true },
    bedNo: { type: String, required: true },
    sharingType: { type: Number, enum: [1, 2, 3, 4], required: true },
    genderTag: { type: String, enum: ["MALE", "FEMALE", "UNISEX"], default: "UNISEX" },
    ac: { type: Boolean, default: false },
    attachedBath: { type: Boolean, default: false },
    status: { type: String, enum: ["VACANT", "BLOCKED", "OCCUPIED", "LEAVING"], default: "VACANT" },
    priceMonthly: { type: Number, required: true },
    tenantUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lockExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bedSchema.index({ pgId: 1, roomNo: 1, bedNo: 1 }, { unique: true });

module.exports = mongoose.model("Bed", bedSchema);
