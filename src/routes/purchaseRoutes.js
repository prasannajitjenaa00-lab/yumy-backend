const router = require("express").Router();
const ctrl = require("../controllers/purchaseController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect, authorize("OWNER", "MANAGER"));
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id/payment-status", ctrl.updatePaymentStatus);

module.exports = router;
