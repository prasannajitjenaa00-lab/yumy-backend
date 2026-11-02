const router = require("express").Router();
const ctrl = require("../controllers/reportController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);

router.get("/dashboard", authorize("OWNER", "MANAGER"), ctrl.dashboard);
router.get("/sales", authorize("OWNER", "MANAGER"), ctrl.salesReport);
router.get("/orders", authorize("OWNER", "MANAGER"), ctrl.orderReport);
router.get("/payments", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.paymentReport);
router.get("/petty-cash", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.pettyCashReport);
router.get("/inventory", authorize("OWNER", "MANAGER"), ctrl.inventoryReport);
router.get("/products", authorize("OWNER", "MANAGER"), ctrl.productReport);
router.get("/gst", authorize("OWNER", "MANAGER"), ctrl.gstReport);

module.exports = router;
