const InventoryItem = require("../models/InventoryItem");
const StockTransaction = require("../models/StockTransaction");
const makeCrudController = require("../utils/crudFactory");
const { recordAudit } = require("../middleware/auditMiddleware");

const base = makeCrudController(InventoryItem, "INVENTORY", { searchFields: ["name", "sku"], populate: ["supplier"] });

async function lowStock(req, res) {
  const items = await InventoryItem.find({ $expr: { $lte: ["$currentStock", "$minimumStock"] } });
  res.json({ success: true, message: "OK", data: items });
}

async function adjustStock(req, res) {
  const { itemId, type, quantity, notes } = req.body;
  const item = await InventoryItem.findById(itemId);
  if (!item) return res.status(404).json({ success: false, message: "Inventory item not found" });

  const delta = ["SALE", "WASTAGE"].includes(type) ? -Math.abs(quantity) : Math.abs(quantity);
  item.currentStock = Math.max(0, item.currentStock + delta);
  await item.save();

  const txn = await StockTransaction.create({
    inventoryItem: item._id,
    type,
    quantity: delta,
    notes,
    createdBy: req.user._id,
  });

  await recordAudit({ user: req.user, action: "ADJUSTMENT", module: "INVENTORY", recordId: item._id, newValue: { type, quantity: delta }, ip: req.ip });

  res.json({ success: true, message: "Stock adjusted", data: { item, transaction: txn } });
}

async function history(req, res) {
  const { itemId } = req.params;
  const txns = await StockTransaction.find({ inventoryItem: itemId }).populate("createdBy", "name").sort({ createdAt: -1 });
  res.json({ success: true, message: "OK", data: txns });
}

async function expiring(req, res) {
  const days = Number(req.query.days) || 7;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  const items = await InventoryItem.find({
    expiryDate: { $lte: targetDate },
    currentStock: { $gt: 0 },
  }).sort({ expiryDate: 1 });

  res.json({ success: true, message: "OK", data: items });
}

module.exports = { ...base, lowStock, adjustStock, history, expiring };
