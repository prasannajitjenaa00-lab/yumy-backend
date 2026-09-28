const mongoose = require("mongoose");

const staffShiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., "Morning Shift", "Evening Shift", "Night Shift"
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true }, // "16:00"
    gracePeriodMinutes: { type: Number, default: 15 }, // Grace period before marked Late
    expectedShiftMinutes: { type: Number, default: 480 }, // Default 8 hours
    color: { type: String, default: "#f97316" }, // Hex color for badge / calendar
    days: {
      type: [String],
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      default: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffShift", staffShiftSchema);
