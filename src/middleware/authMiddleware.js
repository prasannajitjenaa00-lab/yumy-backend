const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authenticated", error: "MISSING_TOKEN" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Not authenticated", error: "INVALID_USER" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session expired or invalid", error: err.message });
  }
}

module.exports = protect;
