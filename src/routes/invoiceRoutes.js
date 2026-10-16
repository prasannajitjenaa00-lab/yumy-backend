const router = require("express").Router();
const ctrl = require("../controllers/invoiceController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.post("/", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.generate);
router.get("/order/:orderId", ctrl.getByOrder);
router.patch("/:id/reprint", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.reprint);

module.exports = router;
