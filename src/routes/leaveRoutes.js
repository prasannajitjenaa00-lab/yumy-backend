const router = require("express").Router();
const ctrl = require("../controllers/leaveController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);

// ── Employee Self-Service ──
router.get("/my", ctrl.getMyLeaves);
router.get("/my-balances", ctrl.getMyLeaveBalances);
router.post("/", ctrl.applyLeave);
router.patch("/:id/cancel", ctrl.cancelMyLeave);

// ── Admin / Manager Operations ──
router.get("/", authorize("OWNER", "MANAGER"), ctrl.getAllLeaves);
router.get("/summary", authorize("OWNER", "MANAGER"), ctrl.getLeaveSummary);
router.get("/balances", authorize("OWNER", "MANAGER"), ctrl.getAllLeaveBalances);
router.post("/admin-create", authorize("OWNER", "MANAGER"), ctrl.adminCreateLeave);
router.patch("/:id/approve", authorize("OWNER", "MANAGER"), ctrl.approveLeave);
router.patch("/:id/reject", authorize("OWNER", "MANAGER"), ctrl.rejectLeave);
router.patch("/adjust-balance", authorize("OWNER", "MANAGER"), ctrl.adjustLeaveBalance);

module.exports = router;
