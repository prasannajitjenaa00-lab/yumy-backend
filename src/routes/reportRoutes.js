const router = require("express").Router();
const ctrl = require("../controllers/reportController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect, authorize("OWNER", "MANAGER"));
router.get("/dashboard", ctrl.dashboard);
router.get("/sales", ctrl.salesReport);
router.get("/orders", ctrl.orderReport);
router.get("/payments", ctrl.paymentReport);
router.get("/inventory", ctrl.inventoryReport);
router.get("/products", ctrl.productReport);
router.get("/gst", ctrl.gstReport);

module.exports = router;
