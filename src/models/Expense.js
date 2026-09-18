const mongoose = require("mongoose");

const EXPENSE_CATEGORIES = ["ELECTRICITY", "RENT", "SALARY", "MAINTENANCE", "TRANSPORT", "RAW_MATERIALS", "OTHER"];

const expenseSchema = new mongoose.Schema(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true },
    description: { type: String, trim: true },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"], default: "CASH" },
    date: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiptRef: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
