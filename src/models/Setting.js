const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "restaurant", unique: true },
    restaurantName: { type: String, default: "Yummy Yards" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    gstin: { type: String, default: "" },
    gstPercent: { type: Number, default: 5 },
    cgstPercent: { type: Number, default: 2.5 },
    sgstPercent: { type: Number, default: 2.5 },
    igstPercent: { type: Number, default: 0 },
    serviceChargePercent: { type: Number, default: 0 },
    tableCount: { type: Number, default: 20 },
    counters: { type: [String], default: ["Counter 1", "Counter 2"] },
    printerConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
