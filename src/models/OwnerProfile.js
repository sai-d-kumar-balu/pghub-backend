const mongoose = require("mongoose");

const kycDocumentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["PAN", "AADHAAR", "BANK_PROOF", "OTHER"],
      required: true,
    },
    originalName: { type: String, trim: true, default: "" },
    storedFilename: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ownerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    kycStatus: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING" },
    pan: { type: String, trim: true },
    aadhaar: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    commissionPct: { type: Number, default: 10, min: 0, max: 100 },
    kycReviewNotes: { type: String, trim: true, default: "" },
    kycDocuments: { type: [kycDocumentSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OwnerProfile", ownerProfileSchema);
