const router = require("express").Router();
const ctrl = require("../controllers/kotController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", ctrl.list);
router.post("/send", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.send);
router.patch("/:id/status", authorize("OWNER", "MANAGER", "KITCHEN", "CASHIER"), ctrl.updateStatus);

module.exports = router;
