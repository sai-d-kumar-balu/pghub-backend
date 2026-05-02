const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
  },
  { _id: false }
);

const foodMenuSchema = new mongoose.Schema(
  {
    morning: { type: String, trim: true, default: "" },
    evening: { type: String, trim: true, default: "" },
    night: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const pgPropertySchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    propertyType: {
      type: String,
      enum: ["LADIES", "GENTS", "COLIVING"],
      required: true,
    },
    location: locationSchema,
    address: { type: String, required: true },
    city: { type: String, index: true, required: true },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    amenities: [{ type: String }],
    /** Public image URLs (CDN or uploaded paths) */
    images: [{ type: String, trim: true }],
    /** Veg / meals copy shown on listing (morning, evening, night) */
    foodMenu: { type: foodMenuSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PgProperty", pgPropertySchema);
