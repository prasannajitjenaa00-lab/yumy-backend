const AuditLog = require("../models/AuditLog");

async function list(req, res) {
  const { page = 1, limit = 50, module: moduleName, user } = req.query;
  const query = {};
  if (moduleName) query.module = moduleName;
  if (user) query.user = user;
  const [data, total] = await Promise.all([
    AuditLog.find(query).populate("user", "name role").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    AuditLog.countDocuments(query),
  ]);
  res.json({ success: true, message: "OK", data, meta: { total, page: Number(page), limit: Number(limit) } });
}

module.exports = { list };
