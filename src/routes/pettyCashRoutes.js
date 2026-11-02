const router = require("express").Router();
const ctrl = require("../controllers/pettyCashController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);

router.post("/cash-in", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.recordCashIn);
router.post("/cash-out", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.recordCashOut);
router.get("/summary", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.getSummary);
router.get("/", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.list);

module.exports = router;

