const mongoose = require("mongoose");

const cashierShiftSchema = new mongoose.Schema(
  {
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    openingCash: { type: Number, required: true },
    openingTime: { type: Date, default: Date.now },
    cashSales: { type: Number, default: 0 },
    upiSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    otherSales: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    expectedCash: { type: Number },
    actualCash: { type: Number },
    difference: { type: Number },
    closingTime: { type: Date },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CashierShift", cashierShiftSchema);
