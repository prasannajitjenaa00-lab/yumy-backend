const User = require("../models/User");
const { recordAudit } = require("../middleware/auditMiddleware");

async function list(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, message: "OK", data: users.map((u) => u.toSafeObject()) });
}

async function getOne(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, message: "OK", data: user.toSafeObject() });
}

async function create(req, res) {
  const user = await User.create(req.body);
  await recordAudit({ user: req.user, action: "CREATE", module: "USERS", recordId: user._id, newValue: { name: user.name, role: user.role }, ip: req.ip });
  res.status(201).json({ success: true, message: "User created successfully", data: user.toSafeObject() });
}

async function update(req, res) {
  const payload = { ...req.body };
  delete payload.password;
  const oldDoc = await User.findById(req.params.id);
  if (!oldDoc) return res.status(404).json({ success: false, message: "User not found" });
  const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  await recordAudit({ user: req.user, action: "UPDATE", module: "USERS", recordId: user._id, oldValue: { role: oldDoc.role, isActive: oldDoc.isActive }, newValue: payload, ip: req.ip });
  res.json({ success: true, message: "User updated successfully", data: user.toSafeObject() });
}

async function remove(req, res) {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  await recordAudit({ user: req.user, action: "DELETE", module: "USERS", recordId: user._id, ip: req.ip });
  res.json({ success: true, message: "User deleted successfully" });
}

module.exports = { list, getOne, create, update, remove };
