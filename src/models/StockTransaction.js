const mongoose = require("mongoose");

const STOCK_TXN_TYPES = ["PURCHASE", "SALE", "ADJUSTMENT", "WASTAGE", "RETURN"];

const stockTransactionSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    type: { type: String, enum: STOCK_TXN_TYPES, required: true },
    quantity: { type: Number, required: true },
    reference: { type: String, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
module.exports.STOCK_TXN_TYPES = STOCK_TXN_TYPES;
