const router = require("express").Router();
const ctrl = require("../controllers/categoryController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, ctrl.list);
router.get("/:id", protect, ctrl.getOne);
router.post("/", protect, authorize("OWNER", "MANAGER"), ctrl.create);
router.put("/:id", protect, authorize("OWNER", "MANAGER"), ctrl.update);
router.delete("/:id", protect, authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
