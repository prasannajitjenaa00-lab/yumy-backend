const mongoose = require("mongoose");

const ORDER_STATUSES = ["DRAFT", "OPEN", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "VOID"];
const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY", "COUNTER"];

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    taxPercent: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true },
    kotStatus: { type: String, enum: ["PENDING", "SENT", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"], default: "PENDING" },
  },
  { _id: true }
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

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    orderType: { type: String, enum: ORDER_TYPES, required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: { type: [orderItemSchema], default: [] },
    notes: { type: String, trim: true },
    discount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: "DRAFT" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID" },
    paymentMethod: { type: String, default: null },
    billStatus: { type: String, enum: ["NOT_REQUESTED", "REQUESTED", "PROCESSING", "GENERATED", "PAID"], default: "NOT_REQUESTED" },
    billRequestedAt: { type: Date },
    billRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    billProcessedAt: { type: Date },
    billProcessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: 1 });
orderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.ORDER_TYPES = ORDER_TYPES;
