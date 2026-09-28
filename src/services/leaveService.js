const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Attendance = require("../models/Attendance");

/**
 * Calculate total days between start and end date inclusive
 */
function calculateLeaveDays(start, end, isHalfDay = false) {
  if (isHalfDay) return 0.5;
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Fetch or initialize LeaveBalance document for user and year
 */
async function getOrCreateBalance(userId, year = new Date().getFullYear()) {
  let balance = await LeaveBalance.findOne({ employee: userId, year });
  if (!balance) {
    balance = await LeaveBalance.create({
      employee: userId,
      year,
      balances: {
        CASUAL: { total: 12, used: 0 },
        SICK: { total: 7, used: 0 },
        ANNUAL: { total: 15, used: 0 },
        EMERGENCY: { total: 3, used: 0 },
        UNPAID: { total: 999, used: 0 },
      },
    });
  }
  return balance;
}

/**
 * Check if employee already has an active overlapping leave request
 */
async function checkLeaveOverlap(userId, start, end, excludeLeaveId = null) {
  const query = {
    employee: userId,
    status: { $in: ["PENDING", "APPROVED"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  };
  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }
  return await Leave.findOne(query);
}

/**
 * Sync attendance records across the approved leave date range
 */
async function syncLeaveAttendance(employeeId, startDate, endDate, leaveType, reason, adminId) {
  const curr = new Date(startDate);
  const end = new Date(endDate);
  curr.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    const dateToSync = new Date(curr);
    const existingAtt = await Attendance.findOne({ user: employeeId, date: dateToSync });
    
    // Only upsert ON_LEAVE if the employee has not physically checked in
    if (!existingAtt || !existingAtt.checkInTime) {
      await Attendance.findOneAndUpdate(
        { user: employeeId, date: dateToSync },
        {
          user: employeeId,
          date: dateToSync,
          status: "ON_LEAVE",
          notes: `${leaveType.replace("_", " ")} Leave: ${reason}`,
          markedBy: adminId,
        },
        { upsert: true, new: true }
      );
    }
    curr.setDate(curr.getDate() + 1);
  }
}

/**
 * Deduct leave days from user's leave balance
 */
async function deductLeaveBalance(employeeId, year, leaveType, days) {
  if (leaveType === "UNPAID") return;
  const balanceDoc = await getOrCreateBalance(employeeId, year);
  if (balanceDoc.balances[leaveType]) {
    balanceDoc.balances[leaveType].used += days;
    await balanceDoc.save();
  }
}

module.exports = {
  calculateLeaveDays,
  getOrCreateBalance,
  checkLeaveOverlap,
  syncLeaveAttendance,
  deductLeaveBalance,
};
