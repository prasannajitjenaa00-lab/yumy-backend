const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const User = require("../models/User");
const { recordAudit } = require("../middleware/auditMiddleware");
const {
  calculateLeaveDays,
  getOrCreateBalance,
  checkLeaveOverlap,
  syncLeaveAttendance,
  deductLeaveBalance,
} = require("../services/leaveService");

// ───── EMPLOYEE: GET MY LEAVE REQUESTS ─────
async function getMyLeaves(req, res) {
  try {
    const { status, leaveType, from, to } = req.query;
    const query = { employee: req.user._id };

    if (status && status !== "ALL") query.status = status;
    if (leaveType && leaveType !== "ALL") query.leaveType = leaveType;
    if (from || to) {
      query.startDate = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }

    const leaves = await Leave.find(query)
      .populate("employee", "name email role phone")
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, message: "OK", data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── EMPLOYEE: GET MY LEAVE BALANCES ─────
async function getMyLeaveBalances(req, res) {
  try {
    const balance = await getOrCreateBalance(req.user._id);
    res.json({ success: true, message: "OK", data: balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── EMPLOYEE: APPLY LEAVE ─────
async function applyLeave(req, res) {
  try {
    const { leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, attachment, attachmentName } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: "Leave type, start date, end date, and reason are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      return res.status(400).json({ success: false, message: "End date cannot be before start date" });
    }

    const days = calculateLeaveDays(start, end, halfDay);

    // Check for overlapping approved or pending requests
    const overlap = await checkLeaveOverlap(req.user._id, start, end);
    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${overlap.status.toLowerCase()} leave request overlapping with these dates (${overlap.leaveType})`,
      });
    }

    // Check balance
    const balanceDoc = await getOrCreateBalance(req.user._id);
    const currentBalance = balanceDoc.balances[leaveType] || { total: 0, used: 0 };
    const remaining = currentBalance.total - currentBalance.used;

    if (leaveType !== "UNPAID" && days > remaining) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You requested ${days} day(s), but only have ${remaining} ${leaveType} leave(s) remaining`,
      });
    }

    const leave = new Leave({
      employee: req.user._id,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      halfDay: Boolean(halfDay),
      halfDayPeriod: halfDay ? halfDayPeriod : null,
      reason,
      attachment: attachment || "",
      attachmentName: attachmentName || "",
      status: "PENDING",
      appliedBy: "EMPLOYEE",
    });

    await leave.save();
    await leave.populate("employee", "name email role phone");

    await recordAudit({
      user: req.user,
      action: "APPLY_LEAVE",
      module: "LEAVE",
      recordId: leave._id,
      newValue: { leaveType, days, startDate: start, endDate: end, reason },
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Leave request submitted successfully", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── EMPLOYEE: CANCEL PENDING LEAVE ─────
async function cancelMyLeave(req, res) {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, employee: req.user._id });
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    if (leave.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Cannot cancel leave with status ${leave.status}` });
    }

    leave.status = "CANCELLED";
    leave.cancelledAt = new Date();
    await leave.save();

    await recordAudit({
      user: req.user,
      action: "CANCEL_LEAVE",
      module: "LEAVE",
      recordId: leave._id,
      newValue: { status: "CANCELLED" },
      ip: req.ip,
    });

    res.json({ success: true, message: "Leave request cancelled", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: GET ALL LEAVE REQUESTS ─────
async function getAllLeaves(req, res) {
  try {
    const { employeeId, status, leaveType, from, to, search } = req.query;
    const query = {};

    if (employeeId) query.employee = employeeId;
    if (status && status !== "ALL") query.status = status;
    if (leaveType && leaveType !== "ALL") query.leaveType = leaveType;
    if (from || to) {
      query.startDate = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }

    let leaves = await Leave.find(query)
      .populate("employee", "name email role phone")
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name")
      .sort({ createdAt: -1 });

    if (search) {
      const q = search.toLowerCase();
      leaves = leaves.filter(
        (l) =>
          l.employee?.name?.toLowerCase().includes(q) ||
          l.employee?.role?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, message: "OK", data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: GET LEAVE SUMMARY ─────
async function getLeaveSummary(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, approved, rejected, currentlyOnLeave, allApproved] = await Promise.all([
      Leave.countDocuments({ status: "PENDING" }),
      Leave.countDocuments({ status: "APPROVED" }),
      Leave.countDocuments({ status: "REJECTED" }),
      Leave.countDocuments({
        status: "APPROVED",
        startDate: { $lte: today },
        endDate: { $gte: today },
      }),
      Leave.find({ status: "APPROVED" }),
    ]);

    const totalDays = allApproved.reduce((acc, l) => acc + (l.days || 1), 0);

    res.json({
      success: true,
      message: "OK",
      data: {
        pendingRequests: pending,
        approvedRequests: approved,
        rejectedRequests: rejected,
        currentlyOnLeave,
        totalLeaveDays: totalDays,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: APPROVE LEAVE ─────
async function approveLeave(req, res) {
  try {
    const { adminComment } = req.body;
    const leave = await Leave.findById(req.params.id).populate("employee", "name email role");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    if (leave.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Leave is already ${leave.status}` });
    }

    leave.status = "APPROVED";
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    if (adminComment) leave.adminComment = adminComment;
    await leave.save();

    // Deduct leave balance
    await deductLeaveBalance(leave.employee._id, leave.startDate.getFullYear(), leave.leaveType, leave.days);

    // Sync Attendance records for each date in leave period
    await syncLeaveAttendance(
      leave.employee._id,
      leave.startDate,
      leave.endDate,
      leave.leaveType,
      leave.reason,
      req.user._id
    );

    await recordAudit({
      user: req.user,
      action: "APPROVE_LEAVE",
      module: "LEAVE",
      recordId: leave._id,
      newValue: { status: "APPROVED", adminComment },
      ip: req.ip,
    });

    res.json({ success: true, message: "Leave request approved successfully", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: REJECT LEAVE ─────
async function rejectLeave(req, res) {
  try {
    const { adminComment, reason } = req.body;
    const leave = await Leave.findById(req.params.id).populate("employee", "name email role");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    if (leave.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Leave is already ${leave.status}` });
    }

    leave.status = "REJECTED";
    leave.rejectedBy = req.user._id;
    leave.rejectedAt = new Date();
    leave.adminComment = adminComment || reason || "Leave request rejected";
    await leave.save();

    await recordAudit({
      user: req.user,
      action: "REJECT_LEAVE",
      module: "LEAVE",
      recordId: leave._id,
      newValue: { status: "REJECTED", adminComment: leave.adminComment },
      ip: req.ip,
    });

    res.json({ success: true, message: "Leave request rejected", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: CREATE LEAVE FOR EMPLOYEE ─────
async function adminCreateLeave(req, res) {
  try {
    const { employeeId, leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, status = "APPROVED", adminComment } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: "Employee, leave type, start date, end date, and reason are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const days = calculateLeaveDays(start, end, halfDay);

    const leave = new Leave({
      employee: employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      halfDay: Boolean(halfDay),
      halfDayPeriod: halfDay ? halfDayPeriod : null,
      reason,
      status,
      adminComment: adminComment || "Created by Admin",
      appliedBy: "ADMIN",
      approvedBy: status === "APPROVED" ? req.user._id : null,
      approvedAt: status === "APPROVED" ? new Date() : null,
    });

    await leave.save();

    if (status === "APPROVED") {
      await deductLeaveBalance(employeeId, start.getFullYear(), leaveType, days);
      await syncLeaveAttendance(employeeId, start, end, leaveType, reason, req.user._id);
    }

    await recordAudit({
      user: req.user,
      action: "ADMIN_CREATE_LEAVE",
      module: "LEAVE",
      recordId: leave._id,
      newValue: { employeeId, leaveType, days, status },
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Leave created successfully", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: GET ALL LEAVE BALANCES ─────
async function getAllLeaveBalances(req, res) {
  try {
    const users = await User.find({ isActive: true }).select("name email role phone").lean();
    const year = Number(req.query.year) || new Date().getFullYear();

    const balances = await Promise.all(
      users.map(async (u) => {
        const bal = await getOrCreateBalance(u._id, year);
        return {
          employee: u,
          balances: bal.balances,
          year: bal.year,
        };
      })
    );

    res.json({ success: true, message: "OK", data: balances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── ADMIN: ADJUST LEAVE BALANCE ─────
async function adjustLeaveBalance(req, res) {
  try {
    const { employeeId, leaveType, total, used, reason } = req.body;
    if (!employeeId || !leaveType) {
      return res.status(400).json({ success: false, message: "Employee and leave type are required" });
    }

    const year = Number(req.body.year) || new Date().getFullYear();
    const balanceDoc = await getOrCreateBalance(employeeId, year);

    if (total !== undefined) balanceDoc.balances[leaveType].total = Number(total);
    if (used !== undefined) balanceDoc.balances[leaveType].used = Number(used);

    await balanceDoc.save();

    await recordAudit({
      user: req.user,
      action: "ADJUST_LEAVE_BALANCE",
      module: "LEAVE",
      recordId: balanceDoc._id,
      newValue: { employeeId, leaveType, total, used, reason },
      ip: req.ip,
    });

    res.json({ success: true, message: "Leave balance adjusted successfully", data: balanceDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getMyLeaves,
  getMyLeaveBalances,
  applyLeave,
  cancelMyLeave,
  getAllLeaves,
  getLeaveSummary,
  approveLeave,
  rejectLeave,
  adminCreateLeave,
  getAllLeaveBalances,
  adjustLeaveBalance,
};
