const mongoose = require("mongoose");

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "OTHER"];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionRef: { type: String, trim: true },
    cashReceived: { type: Number },
    changeReturned: { type: Number },
    isRefund: { type: Boolean, default: false },
    refundReason: { type: String, trim: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
