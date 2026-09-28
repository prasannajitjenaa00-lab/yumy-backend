const Attendance = require("../models/Attendance");
const User = require("../models/User");
const StaffShift = require("../models/StaffShift");
const { recordAudit } = require("../middleware/auditMiddleware");

// Helper: get today's date at midnight (local server time)
function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Helper: parse "HH:mm" → minutes since midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

// ───── CHECK IN ─────
async function checkIn(req, res) {
  try {
    const userId = req.body.userId || req.user._id;
    const note = req.body.note || "";
    const today = getTodayDate();
    const now = new Date();

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Check if already checked in today
    let record = await Attendance.findOne({ user: userId, date: today });
    if (record && record.isCheckedIn) {
      return res.status(400).json({ success: false, message: "Already checked in today" });
    }
    if (record && record.checkOutTime) {
      return res.status(400).json({ success: false, message: "Already completed attendance for today (checked in and out)" });
    }

    // Look up assigned shift for this user
    const assignedShift = await StaffShift.findOne({ assignedUsers: userId, isActive: true });

    // Determine shift start and if late
    const shiftStartTime = req.body.shiftStartTime || assignedShift?.startTime || "09:00";
    const expectedMinutes = req.body.expectedShiftMinutes || assignedShift?.expectedShiftMinutes || 480;
    const gracePeriod = assignedShift?.gracePeriodMinutes !== undefined ? assignedShift.gracePeriodMinutes : 15;
    const shiftStartMinutes = parseTimeToMinutes(shiftStartTime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isLate = currentMinutes > shiftStartMinutes + gracePeriod;
    const lateByMinutes = isLate ? currentMinutes - shiftStartMinutes : 0;

    if (!record) {
      record = new Attendance({
        user: userId,
        date: today,
        checkInTime: now,
        isCheckedIn: true,
        status: isLate ? "LATE" : "PRESENT",
        isLate,
        lateByMinutes,
        shiftStartTime,
        expectedShiftMinutes: expectedMinutes,
        checkInNote: note,
        markedBy: req.user._id,
      });
    } else {
      // Updating existing record (e.g., was marked ABSENT/LEAVE but now checking in)
      record.checkInTime = now;
      record.isCheckedIn = true;
      record.status = isLate ? "LATE" : "PRESENT";
      record.isLate = isLate;
      record.lateByMinutes = lateByMinutes;
      record.checkInNote = note;
      record.markedBy = req.user._id;
    }

    await record.save();
    await record.populate("user", "name email role phone");

    await recordAudit({
      user: req.user, action: "CHECK_IN", module: "ATTENDANCE",
      recordId: record._id, newValue: { userId, checkInTime: now }, ip: req.ip,
    });

    res.status(200).json({ success: true, message: `Checked in successfully${isLate ? " (Late)" : ""}`, data: record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate attendance record" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── CHECK OUT ─────
async function checkOut(req, res) {
  try {
    const userId = req.body.userId || req.user._id;
    const note = req.body.note || "";
    const today = getTodayDate();
    const now = new Date();

    const record = await Attendance.findOne({ user: userId, date: today });
    if (!record || !record.isCheckedIn) {
      return res.status(400).json({ success: false, message: "Not checked in today" });
    }
    if (record.checkOutTime) {
      return res.status(400).json({ success: false, message: "Already checked out today" });
    }

    record.checkOutTime = now;
    record.isCheckedIn = false;
    record.checkOutNote = note;

    // Calculate early leave
    const shiftStartMinutes = parseTimeToMinutes(record.shiftStartTime || "09:00");
    const expectedEndMinutes = shiftStartMinutes + (record.expectedShiftMinutes || 480);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes < expectedEndMinutes - 15) {
      record.isEarlyLeave = true;
      record.earlyLeaveByMinutes = expectedEndMinutes - currentMinutes;
    }

    // Recalculate work metrics
    record.recalculate();
    await record.save();
    await record.populate("user", "name email role phone");

    await recordAudit({
      user: req.user, action: "CHECK_OUT", module: "ATTENDANCE",
      recordId: record._id, newValue: { userId, checkOutTime: now, totalWorkMinutes: record.totalWorkMinutes }, ip: req.ip,
    });

    res.json({ success: true, message: "Checked out successfully", data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── START BREAK ─────
async function startBreak(req, res) {
  try {
    const userId = req.body.userId || req.user._id;
    const reason = req.body.reason || "";
    const today = getTodayDate();

    const record = await Attendance.findOne({ user: userId, date: today });
    if (!record || !record.isCheckedIn) {
      return res.status(400).json({ success: false, message: "Not checked in" });
    }

    // Check if already on a break
    const activeBreak = record.breaks.find((b) => b.breakStart && !b.breakEnd);
    if (activeBreak) {
      return res.status(400).json({ success: false, message: "Already on a break" });
    }

    record.breaks.push({ breakStart: new Date(), reason });
    await record.save();
    await record.populate("user", "name email role phone");

    res.json({ success: true, message: "Break started", data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── END BREAK ─────
async function endBreak(req, res) {
  try {
    const userId = req.body.userId || req.user._id;
    const today = getTodayDate();

    const record = await Attendance.findOne({ user: userId, date: today });
    if (!record || !record.isCheckedIn) {
      return res.status(400).json({ success: false, message: "Not checked in" });
    }

    const activeBreak = record.breaks.find((b) => b.breakStart && !b.breakEnd);
    if (!activeBreak) {
      return res.status(400).json({ success: false, message: "No active break to end" });
    }

    activeBreak.breakEnd = new Date();
    record.totalBreakMinutes = record.calculateBreakMinutes();
    await record.save();
    await record.populate("user", "name email role phone");

    res.json({ success: true, message: "Break ended", data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET TODAY'S STATUS ─────
async function getTodayStatus(req, res) {
  try {
    const today = getTodayDate();
    const isManager = ["OWNER", "MANAGER"].includes(req.user.role);

    // If not manager/owner, strictly return only the user's own status
    if (!isManager) {
      const record = await Attendance.findOne({ user: req.user._id, date: today }).populate("user", "name email role phone").lean();
      const currentStatus = record
        ? record.isCheckedIn
          ? record.breaks?.some((b) => b.breakStart && !b.breakEnd) ? "ON_BREAK" : "CHECKED_IN"
          : record.checkOutTime ? "CHECKED_OUT" : "NOT_CHECKED_IN"
        : "NOT_CHECKED_IN";
      return res.json({
        success: true,
        message: "OK",
        data: [{ user: req.user, attendance: record || null, currentStatus }],
      });
    }

    // Get all active users (staff) for Owner/Manager
    const users = await User.find({ isActive: true }).select("name email role phone").lean();
    const records = await Attendance.find({ date: today }).populate("user", "name email role phone").lean();

    // Build a map of userId → attendance record
    const recordMap = {};
    for (const r of records) {
      recordMap[String(r.user._id)] = r;
    }

    // Merge: every user gets an entry, even if no attendance record exists
    const statusList = users.map((u) => {
      const rec = recordMap[String(u._id)];
      return {
        user: u,
        attendance: rec || null,
        currentStatus: rec
          ? rec.isCheckedIn
            ? rec.breaks?.some((b) => b.breakStart && !b.breakEnd) ? "ON_BREAK" : "CHECKED_IN"
            : rec.checkOutTime ? "CHECKED_OUT" : "NOT_CHECKED_IN"
          : "NOT_CHECKED_IN",
      };
    });

    res.json({ success: true, message: "OK", data: statusList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET MY STATUS (self) ─────
async function getMyStatus(req, res) {
  try {
    const today = getTodayDate();
    const record = await Attendance.findOne({ user: req.user._id, date: today }).populate("user", "name email role phone");

    const currentStatus = record
      ? record.isCheckedIn
        ? record.breaks?.some((b) => b.breakStart && !b.breakEnd) ? "ON_BREAK" : "CHECKED_IN"
        : record.checkOutTime ? "CHECKED_OUT" : "NOT_CHECKED_IN"
      : "NOT_CHECKED_IN";

    res.json({
      success: true, message: "OK",
      data: { user: req.user, attendance: record, currentStatus },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET ATTENDANCE HISTORY (with filters) ─────
async function getAttendanceHistory(req, res) {
  try {
    const { userId, from, to, status, page = 1, limit = 50 } = req.query;
    const isManager = ["OWNER", "MANAGER"].includes(req.user.role);
    const query = {};

    if (isManager) {
      if (userId) query.user = userId;
    } else {
      query.user = req.user._id;
    }

    if (status) query.status = status;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate("user", "name email role phone")
        .populate("markedBy", "name")
        .sort({ date: -1, checkInTime: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true, message: "OK", data: records,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── MARK ATTENDANCE MANUALLY (manager/owner) ─────
async function markAttendance(req, res) {
  try {
    const { userId, date, status, notes } = req.body;
    if (!userId || !date || !status) {
      return res.status(400).json({ success: false, message: "userId, date, and status are required" });
    }

    const dateObj = new Date(date);
    const record = await Attendance.findOneAndUpdate(
      { user: userId, date: dateObj },
      {
        user: userId,
        date: dateObj,
        status,
        notes,
        markedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    await recordAudit({
      user: req.user, action: "MARK_ATTENDANCE", module: "ATTENDANCE",
      recordId: record._id, newValue: { userId, date, status, notes }, ip: req.ip,
    });

    res.json({ success: true, message: "Attendance recorded", data: record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate attendance record" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET ATTENDANCE SUMMARY / STATS ─────
async function getAttendanceSummary(req, res) {
  try {
    const { userId, from, to } = req.query;
    const today = getTodayDate();
    const isManager = ["OWNER", "MANAGER"].includes(req.user.role);

    // Default: current month
    const startDate = from ? new Date(from) : new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = to ? new Date(to) : today;

    const query = { date: { $gte: startDate, $lte: endDate } };
    if (isManager) {
      if (userId) query.user = userId;
    } else {
      query.user = req.user._id;
    }

    const records = await Attendance.find(query).lean();

    // Aggregate stats
    const summary = {
      totalDays: records.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      late: records.filter((r) => r.status === "LATE").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      halfDay: records.filter((r) => r.status === "HALF_DAY").length,
      leave: records.filter((r) => ["LEAVE", "ON_LEAVE"].includes(r.status)).length,
      totalWorkMinutes: records.reduce((s, r) => s + (r.totalWorkMinutes || 0), 0),
      totalOvertimeMinutes: records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0),
      totalBreakMinutes: records.reduce((s, r) => s + (r.totalBreakMinutes || 0), 0),
      avgWorkMinutesPerDay: 0,
      lateCount: records.filter((r) => r.isLate).length,
      earlyLeaveCount: records.filter((r) => r.isEarlyLeave).length,
    };

    const workedDays = records.filter((r) => r.totalWorkMinutes > 0).length;
    summary.avgWorkMinutesPerDay = workedDays > 0 ? Math.round(summary.totalWorkMinutes / workedDays) : 0;

    // Currently checked-in users (Owner/Manager see everyone, regular staff see themselves)
    const checkedInQuery = { date: today, isCheckedIn: true };
    if (!isManager) checkedInQuery.user = req.user._id;

    const checkedIn = await Attendance.find(checkedInQuery)
      .populate("user", "name email role phone").lean();

    res.json({
      success: true, message: "OK",
      data: { summary, checkedInNow: checkedIn, period: { from: startDate, to: endDate } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayStatus,
  getMyStatus,
  getAttendanceHistory,
  markAttendance,
  getAttendanceSummary,
};
