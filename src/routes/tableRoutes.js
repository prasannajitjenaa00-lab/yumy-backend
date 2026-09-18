const router = require("express").Router();
const ctrl = require("../controllers/tableController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, ctrl.list);
router.post("/", protect, authorize("OWNER", "MANAGER"), ctrl.create);
router.post("/bulk", protect, authorize("OWNER", "MANAGER"), ctrl.bulkCreate);
router.put("/:id", protect, authorize("OWNER", "MANAGER", "WAITER", "CASHIER"), ctrl.update);
router.delete("/:id", protect, authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
