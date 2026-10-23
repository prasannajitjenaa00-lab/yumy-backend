const Setting = require("../models/Setting");
const { recordAudit } = require("../middleware/auditMiddleware");

async function get(req, res) {
  let setting = await Setting.findOne({ key: "restaurant" });
  if (!setting) {
    setting = await Setting.create({ key: "restaurant", counters: ["Counter 1", "Counter 2"] });
  } else if (!setting.counters || !setting.counters.length) {
    setting.counters = ["Counter 1", "Counter 2"];
    await setting.save();
  }
  res.json({ success: true, message: "OK", data: setting });
}

async function update(req, res) {
  const oldDoc = await Setting.findOne({ key: "restaurant" });
  const payload = { ...req.body };
  if (Array.isArray(payload.counters)) {
    payload.counters = [...new Set(payload.counters.map((c) => String(c).trim()).filter(Boolean))];
    if (!payload.counters.length) {
      payload.counters = ["Counter 1"];
    }
  }
  const setting = await Setting.findOneAndUpdate({ key: "restaurant" }, payload, { new: true, upsert: true, runValidators: true });
  await recordAudit({ user: req.user, action: "UPDATE", module: "SETTINGS", recordId: setting._id, oldValue: oldDoc, newValue: req.body, ip: req.ip });
  res.json({ success: true, message: "Settings updated", data: setting });
}

module.exports = { get, update };
