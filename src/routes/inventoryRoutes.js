const router = require("express").Router();
const ctrl = require("../controllers/inventoryController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect);
router.get("/", ctrl.list);
router.get("/low-stock", ctrl.lowStock);
router.get("/:id", ctrl.getOne);
router.get("/:itemId/history", ctrl.history);
router.post("/", authorize("OWNER", "MANAGER"), ctrl.create);
router.put("/:id", authorize("OWNER", "MANAGER"), ctrl.update);
router.post("/adjust", authorize("OWNER", "MANAGER"), ctrl.adjustStock);
router.delete("/:id", authorize("OWNER", "MANAGER"), ctrl.remove);

module.exports = router;
