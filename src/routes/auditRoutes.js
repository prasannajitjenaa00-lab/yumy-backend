const router = require("express").Router();
const ctrl = require("../controllers/auditController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, authorize("OWNER"), ctrl.list);

module.exports = router;
