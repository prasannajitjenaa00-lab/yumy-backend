const router = require("express").Router();
const ctrl = require("../controllers/supplierController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.use(protect, authorize("OWNER", "MANAGER"));
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
