const router = require("express").Router();
const ctrl = require("../controllers/staffController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect, authorize("OWNER", "MANAGER"));
router.get("/", ctrl.getAttendance);
router.post("/", ctrl.markAttendance);

module.exports = router;
