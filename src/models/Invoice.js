const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: { type: mongoose.Schema.Types.Mixed, default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paymentStatus: { type: String, default: "UNPAID" },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reprintCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
