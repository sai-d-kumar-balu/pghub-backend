const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pgId: { type: mongoose.Schema.Types.ObjectId, ref: "PgProperty", required: true },
    type: { type: String, enum: ["COMPLAINT", "VACATE", "REFUND"], required: true },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"], default: "OPEN" },
    description: { type: String, required: true, trim: true },
    resolution: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
