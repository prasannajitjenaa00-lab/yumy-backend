const Table = require("../models/Table");
const { recordAudit } = require("../middleware/auditMiddleware");

async function list(req, res) {
  const tables = await Table.find({ isActive: true }).populate("currentOrder").sort({ number: 1 });
  res.json({ success: true, message: "OK", data: tables });
}

async function create(req, res) {
  const table = await Table.create(req.body);
  res.status(201).json({ success: true, message: "Table created", data: table });
}

async function bulkCreate(req, res) {
  const { count, zone } = req.body;
  const existing = await Table.countDocuments();
  const docs = [];
  for (let i = 1; i <= Number(count); i += 1) {
    docs.push({ number: existing + i, zone: zone || "Main Hall" });
  }
  const tables = await Table.insertMany(docs);
  res.status(201).json({ success: true, message: `${tables.length} tables created`, data: tables });
}

async function update(req, res) {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!table) return res.status(404).json({ success: false, message: "Table not found" });
  res.json({ success: true, message: "Table updated", data: table });
}

async function remove(req, res) {
  const table = await Table.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!table) return res.status(404).json({ success: false, message: "Table not found" });
  await recordAudit({ user: req.user, action: "DELETE", module: "TABLES", recordId: table._id, ip: req.ip });
  res.json({ success: true, message: "Table removed" });
}

module.exports = { list, create, bulkCreate, update, remove };
