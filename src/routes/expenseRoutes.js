const router = require("express").Router();
const ctrl = require("../controllers/expenseController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", authorize("OWNER", "MANAGER"), ctrl.list);
router.post("/", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.create);
router.put("/:id", authorize("OWNER", "MANAGER"), ctrl.update);
router.delete("/:id", authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
