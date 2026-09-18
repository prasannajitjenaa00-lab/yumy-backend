const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    quantity: { type: Number, required: true },
    purchasePrice: { type: Number, required: true },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: { type: [purchaseItemSchema], default: [] },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY_PAID", "PAID"], default: "UNPAID" },
    purchaseDate: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);
