const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "OWNER", "USER"], default: "USER" },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], default: "OTHER" },
    status: { type: String, enum: ["ACTIVE", "BLOCKED"], default: "ACTIVE" },
    profession: { type: String, trim: true },
    address: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    avatar: {
      fileId: { type: String, trim: true, default: "" },
      storedFilename: { type: String, trim: true, default: "" },
      mimeType: { type: String, trim: true, default: "" },
      size: { type: Number, default: 0 },
      updatedAt: { type: Date, default: null },
    },
    tenantDocuments: {
      type: [
        {
          fileId: { type: String, required: true, trim: true },
          kind: { type: String, trim: true, default: "OTHER" },
          originalName: { type: String, trim: true, default: "" },
          storedFilename: { type: String, required: true, trim: true },
          mimeType: { type: String, trim: true, default: "" },
          size: { type: Number, default: 0 },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Explicitly create index on phone field for faster queries
userSchema.index({ phone: 1 });

module.exports = mongoose.model("User", userSchema);
