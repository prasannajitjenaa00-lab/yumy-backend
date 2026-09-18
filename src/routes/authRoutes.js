const router = require("express").Router();
const ctrl = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post("/login", loginLimiter, ctrl.login);
router.get("/me", protect, ctrl.me);
router.post("/logout", protect, ctrl.logout);
router.post("/change-password", protect, ctrl.changePassword);

module.exports = router;
