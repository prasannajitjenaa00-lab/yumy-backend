const mongoose = require("mongoose");

const PETTY_CASH_CATEGORIES = [
  "RAW_MATERIALS",
  "SUPPLIES",
  "TRANSPORT",
  "MAINTENANCE",
  "STAFF_TEA_SNACKS",
  "FLOAT_TOPUP",
  "UTILITIES",
  "OTHER",
];

const pettyCashSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["CASH_IN", "CASH_OUT"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    category: {
      type: String,
      enum: PETTY_CASH_CATEGORIES,
      default: "OTHER",
    },
    reason: {
      type: String,
      required: [true, "Reason or description is required"],
      trim: true,
    },
    paidTo: {
      type: String,
      trim: true,
      default: "",
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiptRef: {
      type: String,
      trim: true,
      default: "",
    },
    counterId: {
      type: String,
      trim: true,
      default: "Counter 1",
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CashierShift",
      default: null,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PettyCash", pettyCashSchema);
module.exports.PETTY_CASH_CATEGORIES = PETTY_CASH_CATEGORIES;

