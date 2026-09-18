const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    totalOrders: { type: Number, default: 0 },
    totalSpending: { type: Number, default: 0 },
    lastOrderAt: { type: Date },
    loyaltyPoints: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
