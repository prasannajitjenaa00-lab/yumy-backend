const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    joiningDate: { type: Date, default: Date.now },
    salary: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Staff", staffSchema);
