const router = require("express").Router();
const ctrl = require("../controllers/paymentController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/order/:orderId", ctrl.listByOrder);
router.post("/", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.recordPayment);
router.post("/refund", authorize("OWNER", "MANAGER"), ctrl.recordRefund);

module.exports = router;
