const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"], required: true },
    notes: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
