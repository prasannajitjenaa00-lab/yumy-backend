const mongoose = require("mongoose");

const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "BILL_PENDING", "CLEANING"];

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    zone: { type: String, trim: true, default: "Main Hall" },
    capacity: { type: Number, default: 4 },
    status: { type: String, enum: TABLE_STATUSES, default: "AVAILABLE" },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tableSchema);
module.exports.TABLE_STATUSES = TABLE_STATUSES;
