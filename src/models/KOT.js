const mongoose = require("mongoose");

const KOT_STATUSES = ["PENDING", "SENT", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"];

const kotItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    previousStatus: String,
    newStatus: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const kotSchema = new mongoose.Schema(
  {
    kotNumber: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    counter: { type: String, default: "Counter 1", trim: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null },
    orderType: { type: String, required: true },
    items: { type: [kotItemSchema], default: [] },
    status: { type: String, enum: KOT_STATUSES, default: "PENDING" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KOT", kotSchema);
module.exports.KOT_STATUSES = KOT_STATUSES;
