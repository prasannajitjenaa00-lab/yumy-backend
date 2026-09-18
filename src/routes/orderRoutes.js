const router = require("express").Router();
const ctrl = require("../controllers/orderController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", ctrl.list);
router.get("/bill-requests/list", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.listBillRequests);
router.get("/:id", ctrl.getOne);
router.post("/", authorize("OWNER", "MANAGER", "CASHIER", "WAITER"), ctrl.create);
router.put("/:id/items", authorize("OWNER", "MANAGER", "CASHIER", "WAITER"), ctrl.updateItems);
router.patch("/:id/status", authorize("OWNER", "MANAGER", "CASHIER", "KITCHEN", "WAITER"), ctrl.updateStatus);
router.post("/:id/cancel", authorize("OWNER", "MANAGER", "CASHIER", "WAITER"), ctrl.cancel);
router.post("/:id/request-bill", authorize("OWNER", "MANAGER", "CASHIER", "WAITER"), ctrl.requestBill);
router.post("/:id/process-bill", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.processBill);
router.post("/:id/clear-table", authorize("OWNER", "MANAGER", "CASHIER", "WAITER"), ctrl.clearTable);

module.exports = router;
