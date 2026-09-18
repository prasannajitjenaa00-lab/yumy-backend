const router = require("express").Router();
const ctrl = require("../controllers/settingController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, ctrl.get);
router.put("/", protect, authorize("OWNER"), ctrl.update);

module.exports = router;
