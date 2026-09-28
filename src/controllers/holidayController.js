const Holiday = require("../models/Holiday");
const User = require("../models/User");
const { recordAudit } = require("../middleware/auditMiddleware");

// ───── GET ALL HOLIDAYS / OFF DAYS ─────
async function getHolidays(req, res) {
  try {
    const { year, month, from, to, type, status, department, isRecurring } = req.query;
    const isManager = ["OWNER", "MANAGER"].includes(req.user.role);

    const query = {};

    // Status filter (defaults to active unless manager specifies)
    if (status) {
      query.status = status;
    } else if (!isManager) {
      query.status = "ACTIVE";
    }

    if (type) query.type = type;
    if (isRecurring !== undefined) query.isRecurring = isRecurring === "true";

    // Date range filter
    if (from || to) {
      query.$or = [
        {
          startDate: {
            ...(from ? { $gte: new Date(from) } : {}),
            ...(to ? { $lte: new Date(to) } : {}),
          },
        },
        { isRecurring: true },
      ];
    } else if (year) {
      const startOfYear = new Date(Number(year), month ? Number(month) - 1 : 0, 1);
      const endOfYear = new Date(Number(year), month ? Number(month) : 12, 0, 23, 59, 59, 999);
      query.$or = [
        {
          startDate: { $gte: startOfYear, $lte: endOfYear },
        },
        { isRecurring: true },
      ];
    }

    const holidays = await Holiday.find(query)
      .populate("createdBy", "name email role")
      .populate("employees", "name email role phone")
      .sort({ startDate: 1 });

    res.json({ success: true, message: "OK", data: holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET SINGLE HOLIDAY ─────
async function getHolidayById(req, res) {
  try {
    const holiday = await Holiday.findById(req.params.id)
      .populate("createdBy", "name email role")
      .populate("employees", "name email role phone");

    if (!holiday) {
      return res.status(404).json({ success: false, message: "Holiday not found" });
    }

    res.json({ success: true, message: "OK", data: holiday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── CREATE HOLIDAY / OFF DAY ─────
async function createHoliday(req, res) {
  try {
    const {
      name,
      type,
      startDate,
      endDate,
      description,
      reason,
      appliesTo,
      departments,
      employees,
      isRecurring,
      recurringDay,
      notifyEmployees,
      color,
    } = req.body;

    if (!name || !startDate) {
      return res.status(400).json({ success: false, message: "Holiday name and start date are required" });
    }

    const holiday = new Holiday({
      name,
      type: type || "PUBLIC_HOLIDAY",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      description: description || "",
      reason: reason || "",
      appliesTo: appliesTo || "ORGANIZATION",
      departments: Array.isArray(departments) ? departments : [],
      employees: Array.isArray(employees) ? employees : [],
      isRecurring: Boolean(isRecurring),
      recurringDay: recurringDay || null,
      notifyEmployees: Boolean(notifyEmployees),
      color: color || "",
      createdBy: req.user._id,
      status: "ACTIVE",
    });

    await holiday.save();
    await holiday.populate("createdBy", "name email role");
    await holiday.populate("employees", "name email role");

    await recordAudit({
      user: req.user,
      action: "CREATE_HOLIDAY",
      module: "HOLIDAY",
      recordId: holiday._id,
      newValue: { name, type, startDate, appliesTo },
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Holiday / off-day created successfully", data: holiday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── UPDATE HOLIDAY / OFF DAY ─────
async function updateHoliday(req, res) {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: "Holiday not found" });
    }

    const allowedFields = [
      "name",
      "type",
      "startDate",
      "endDate",
      "description",
      "reason",
      "appliesTo",
      "departments",
      "employees",
      "isRecurring",
      "recurringDay",
      "status",
      "notifyEmployees",
      "color",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "startDate" || field === "endDate") {
          holiday[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          holiday[field] = req.body[field];
        }
      }
    });

    await holiday.save();
    await holiday.populate("createdBy", "name email role");
    await holiday.populate("employees", "name email role");

    await recordAudit({
      user: req.user,
      action: "UPDATE_HOLIDAY",
      module: "HOLIDAY",
      recordId: holiday._id,
      newValue: req.body,
      ip: req.ip,
    });

    res.json({ success: true, message: "Holiday updated successfully", data: holiday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── DELETE HOLIDAY / OFF DAY ─────
async function deleteHoliday(req, res) {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: "Holiday not found" });
    }

    await Holiday.findByIdAndDelete(req.params.id);

    await recordAudit({
      user: req.user,
      action: "DELETE_HOLIDAY",
      module: "HOLIDAY",
      recordId: holiday._id,
      newValue: { name: holiday.name },
      ip: req.ip,
    });

    res.json({ success: true, message: "Holiday removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ───── GET UPCOMING HOLIDAYS ─────
async function getUpcomingHolidays(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holidays = await Holiday.find({
      status: "ACTIVE",
      startDate: { $gte: today },
    })
      .populate("createdBy", "name")
      .sort({ startDate: 1 })
      .limit(10);

    res.json({ success: true, message: "OK", data: holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getUpcomingHolidays,
};
