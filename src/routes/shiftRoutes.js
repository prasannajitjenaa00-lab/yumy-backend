const router = require("express").Router();
const ctrl = require("../controllers/shiftController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", authorize("OWNER", "MANAGER"), ctrl.list);
router.get("/current", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.current);
router.post("/open", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.openShift);
router.patch("/:id/close", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.closeShift);

module.exports = router;
