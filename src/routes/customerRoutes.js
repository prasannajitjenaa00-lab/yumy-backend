const router = require("express").Router();
const ctrl = require("../controllers/customerController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.create);
router.put("/:id", authorize("OWNER", "MANAGER", "CASHIER"), ctrl.update);
router.delete("/:id", authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
