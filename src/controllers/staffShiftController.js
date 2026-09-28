const StaffShift = require("../models/StaffShift");
const { recordAudit } = require("../middleware/auditMiddleware");

// Helper: Calculate duration between "HH:mm" start and "HH:mm" end
function calculateDurationMinutes(start, end) {
  if (!start || !end) return 480;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60; // Crosses midnight
  return endMins - startMins;
}

// ───── LIST ALL SHIFTS ─────
async function list(req, res) {
  try {
    const shifts = await StaffShift.find()
      .populate("assignedUsers", "name email role phone")
      .populate("createdBy", "name")
      .sort({ startTime: 1, name: 1 });
    res.json({ success: true, message: "OK", data: shifts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET SINGLE SHIFT ─────
async function getOne(req, res) {
  try {
    const shift = await StaffShift.findById(req.params.id).populate("assignedUsers", "name email role phone");
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    res.json({ success: true, message: "OK", data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── CREATE SHIFT ─────
async function create(req, res) {
  try {
    const { name, startTime, endTime, gracePeriodMinutes, color, days, assignedUsers, notes } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Name, start time, and end time are required" });
    }

    const duration = calculateDurationMinutes(startTime, endTime);

    const shift = new StaffShift({
      name,
      startTime,
      endTime,
      gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
      expectedShiftMinutes: duration,
      color: color || "#f97316",
      days: Array.isArray(days) && days.length > 0 ? days : ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      assignedUsers: Array.isArray(assignedUsers) ? assignedUsers : [],
      notes,
      createdBy: req.user._id,
    });

    await shift.save();
    await shift.populate("assignedUsers", "name email role phone");

    await recordAudit({
      user: req.user, action: "CREATE", module: "STAFF_SHIFT",
      recordId: shift._id, newValue: { name, startTime, endTime }, ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Staff shift created", data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── UPDATE SHIFT ─────
async function update(req, res) {
  try {
    const { name, startTime, endTime, gracePeriodMinutes, color, days, assignedUsers, isActive, notes } = req.body;
    const shift = await StaffShift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    if (name) shift.name = name;
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (startTime || endTime) {
      shift.expectedShiftMinutes = calculateDurationMinutes(shift.startTime, shift.endTime);
    }
    if (gracePeriodMinutes !== undefined) shift.gracePeriodMinutes = Number(gracePeriodMinutes);
    if (color) shift.color = color;
    if (Array.isArray(days)) shift.days = days;
    if (Array.isArray(assignedUsers)) shift.assignedUsers = assignedUsers;
    if (isActive !== undefined) shift.isActive = Boolean(isActive);
    if (notes !== undefined) shift.notes = notes;

    await shift.save();
    await shift.populate("assignedUsers", "name email role phone");

    await recordAudit({
      user: req.user, action: "UPDATE", module: "STAFF_SHIFT",
      recordId: shift._id, newValue: req.body, ip: req.ip,
    });

    res.json({ success: true, message: "Staff shift updated", data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── DELETE SHIFT ─────
async function remove(req, res) {
  try {
    const shift = await StaffShift.findByIdAndDelete(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    await recordAudit({
      user: req.user, action: "DELETE", module: "STAFF_SHIFT",
      recordId: req.params.id, oldValue: { name: shift.name }, ip: req.ip,
    });

    res.json({ success: true, message: "Shift deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET MY ASSIGNED SHIFT ─────
async function getMyShift(req, res) {
  try {
    const shift = await StaffShift.findOne({ assignedUsers: req.user._id, isActive: true });
    res.json({ success: true, message: "OK", data: shift || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  getMyShift,
};
