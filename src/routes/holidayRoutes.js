const router = require("express").Router();
const ctrl = require("../controllers/holidayController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);

// Read-only for all logged-in staff (to view holidays, closures, off days)
router.get("/", ctrl.getHolidays);
router.get("/upcoming", ctrl.getUpcomingHolidays);
router.get("/:id", ctrl.getHolidayById);

// Manager / Owner management routes
router.post("/", authorize("OWNER", "MANAGER"), ctrl.createHoliday);
router.put("/:id", authorize("OWNER", "MANAGER"), ctrl.updateHoliday);
router.delete("/:id", authorize("OWNER", "MANAGER"), ctrl.deleteHoliday);

module.exports = router;
