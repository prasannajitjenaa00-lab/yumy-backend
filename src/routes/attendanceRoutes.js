const router = require("express").Router();
const ctrl = require("../controllers/attendanceController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// ── Self-service routes (any authenticated user can use) ──
router.get("/my-status", ctrl.getMyStatus);
router.post("/check-in", ctrl.checkIn);
router.post("/check-out", ctrl.checkOut);
router.post("/break/start", ctrl.startBreak);
router.post("/break/end", ctrl.endBreak);

// ── Read-only routes (all authenticated staff) ──
router.get("/today", ctrl.getTodayStatus);
router.get("/history", ctrl.getAttendanceHistory);
router.get("/summary", ctrl.getAttendanceSummary);

// ── Manager/Owner routes ──
router.post("/mark", authorize("OWNER", "MANAGER"), ctrl.markAttendance);

module.exports = router;
