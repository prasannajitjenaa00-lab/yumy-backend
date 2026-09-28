const mongoose = require("mongoose");

const balanceItemSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    year: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    balances: {
      CASUAL: {
        type: balanceItemSchema,
        default: () => ({ total: 12, used: 0 }),
      },
      SICK: {
        type: balanceItemSchema,
        default: () => ({ total: 7, used: 0 }),
      },
      ANNUAL: {
        type: balanceItemSchema,
        default: () => ({ total: 15, used: 0 }),
      },
      EMERGENCY: {
        type: balanceItemSchema,
        default: () => ({ total: 3, used: 0 }),
      },
      UNPAID: {
        type: balanceItemSchema,
        default: () => ({ total: 999, used: 0 }),
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);
