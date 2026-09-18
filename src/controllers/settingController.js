const Setting = require("../models/Setting");
const { recordAudit } = require("../middleware/auditMiddleware");

async function get(req, res) {
  let setting = await Setting.findOne({ key: "restaurant" });
  if (!setting) setting = await Setting.create({ key: "restaurant" });
  res.json({ success: true, message: "OK", data: setting });
}

async function update(req, res) {
  const oldDoc = await Setting.findOne({ key: "restaurant" });
  const setting = await Setting.findOneAndUpdate({ key: "restaurant" }, req.body, { new: true, upsert: true, runValidators: true });
  await recordAudit({ user: req.user, action: "UPDATE", module: "SETTINGS", recordId: setting._id, oldValue: oldDoc, newValue: req.body, ip: req.ip });
  res.json({ success: true, message: "Settings updated", data: setting });
}

module.exports = { get, update };
