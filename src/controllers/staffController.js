const Staff = require("../models/Staff");
const Attendance = require("../models/Attendance");
const makeCrudController = require("../utils/crudFactory");

const base = makeCrudController(Staff, "STAFF", { populate: ["user"] });

async function markAttendance(req, res) {
  const { userId, date, status, notes } = req.body;
  const record = await Attendance.findOneAndUpdate(
    { user: userId, date: new Date(date) },
    { user: userId, date: new Date(date), status, notes, markedBy: req.user._id },
    { new: true, upsert: true }
  );
  res.json({ success: true, message: "Attendance recorded", data: record });
}

async function getAttendance(req, res) {
  const { userId, from, to } = req.query;
  const query = {};
  if (userId) query.user = userId;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const records = await Attendance.find(query).populate("user", "name role").sort({ date: -1 });
  res.json({ success: true, message: "OK", data: records });
}

module.exports = { ...base, markAttendance, getAttendance };
