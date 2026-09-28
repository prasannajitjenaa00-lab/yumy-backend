const router = require("express").Router();
const ctrl = require("../controllers/staffShiftController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);

// Self-service
router.get("/my-shift", ctrl.getMyShift);

// Read-only for all staff (to view schedules/shifts)
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);

// Manager / Owner management routes
router.post("/", authorize("OWNER", "MANAGER"), ctrl.create);
router.put("/:id", authorize("OWNER", "MANAGER"), ctrl.update);
router.delete("/:id", authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
