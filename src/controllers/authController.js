const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { recordAudit } = require("../middleware/auditMiddleware");

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

const ROLE_HOME = {
  OWNER: "/owner/dashboard",
  MANAGER: "/manager/dashboard",
  CASHIER: "/cashier/pos",
  KITCHEN: "/kitchen",
};

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  await recordAudit({ user, action: "LOGIN", module: "AUTH", recordId: user._id, ip: req.ip });

  return res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: user.toSafeObject(),
      redirectTo: ROLE_HOME[user.role],
    },
  });
}

async function me(req, res) {
  return res.json({ success: true, message: "OK", data: req.user.toSafeObject() });
}

async function logout(req, res) {
  await recordAudit({ user: req.user, action: "LOGOUT", module: "AUTH", recordId: req.user._id, ip: req.ip });
  return res.json({ success: true, message: "Logged out" });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: "Current password is incorrect" });
  }
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  return res.json({ success: true, message: "Password updated" });
}

module.exports = { login, me, logout, changePassword, ROLE_HOME };
