const mongoose = require("mongoose");

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "LATE", "ON_LEAVE"];

const breakSchema = new mongoose.Schema(
  {
    breakStart: { type: Date, required: true },
    breakEnd: { type: Date, default: null },
    reason: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, default: "PRESENT" },

    // Check-in / Check-out
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    isCheckedIn: { type: Boolean, default: false },

    // Breaks
    breaks: { type: [breakSchema], default: [] },

    // Computed work metrics (in minutes)
    totalWorkMinutes: { type: Number, default: 0 },
    totalBreakMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },

    // Shift expectations (configurable per restaurant)
    expectedShiftMinutes: { type: Number, default: 480 }, // 8 hours default
    shiftStartTime: { type: String, default: "09:00" }, // expected shift start HH:mm

    // Flags
    isLate: { type: Boolean, default: false },
    isEarlyLeave: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    earlyLeaveByMinutes: { type: Number, default: 0 },

    // Notes & metadata
    notes: { type: String, trim: true },
    checkInNote: { type: String, trim: true },
    checkOutNote: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    autoCheckedOut: { type: Boolean, default: false },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ isCheckedIn: 1 });

// Calculate total break minutes from break entries
attendanceSchema.methods.calculateBreakMinutes = function () {
  let total = 0;
  for (const b of this.breaks) {
    if (b.breakStart && b.breakEnd) {
      total += Math.round((b.breakEnd - b.breakStart) / 60000);
    }
  }
  return total;
};

// Calculate total work minutes = (checkOut - checkIn) - breaks
attendanceSchema.methods.calculateWorkMinutes = function () {
  if (!this.checkInTime || !this.checkOutTime) return 0;
  const totalMinutes = Math.round((this.checkOutTime - this.checkInTime) / 60000);
  const breakMinutes = this.calculateBreakMinutes();
  return Math.max(totalMinutes - breakMinutes, 0);
};

// Recalculate all derived fields
attendanceSchema.methods.recalculate = function () {
  this.totalBreakMinutes = this.calculateBreakMinutes();
  this.totalWorkMinutes = this.calculateWorkMinutes();
  this.overtimeMinutes = Math.max(this.totalWorkMinutes - this.expectedShiftMinutes, 0);

  // Determine status based on work hours
  if (this.checkInTime && this.checkOutTime) {
    if (this.totalWorkMinutes >= this.expectedShiftMinutes * 0.5 && this.totalWorkMinutes < this.expectedShiftMinutes) {
      this.status = "HALF_DAY";
    } else if (this.totalWorkMinutes >= this.expectedShiftMinutes) {
      this.status = this.isLate ? "LATE" : "PRESENT";
    }
  }
};

module.exports = mongoose.model("Attendance", attendanceSchema);
module.exports.ATTENDANCE_STATUSES = ATTENDANCE_STATUSES;
