const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, unique: true, sparse: true },
    unit: { type: String, required: true, trim: true },
    currentStock: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    purchasePrice: { type: Number, default: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    expiryDate: { type: Date },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
