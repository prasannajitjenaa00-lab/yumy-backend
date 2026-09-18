const Purchase = require("../models/Purchase");
const InventoryItem = require("../models/InventoryItem");
const StockTransaction = require("../models/StockTransaction");
const Supplier = require("../models/Supplier");

async function generatePurchaseNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await Purchase.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
  return `PUR-${today}-${String(count + 1).padStart(4, "0")}`;
}

async function list(req, res) {
  const purchases = await Purchase.find().populate("supplier").populate("items.inventoryItem").sort({ createdAt: -1 });
  res.json({ success: true, message: "OK", data: purchases });
}

async function create(req, res) {
  const { supplier, items, taxAmount = 0 } = req.body;

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.purchasePrice, 0);
  const total = itemsTotal + Number(taxAmount);
  const purchaseNumber = await generatePurchaseNumber();

  const purchase = await Purchase.create({
    purchaseNumber,
    supplier,
    items,
    taxAmount,
    total,
    createdBy: req.user._id,
  });

  for (const line of items) {
    const invItem = await InventoryItem.findById(line.inventoryItem);
    if (invItem) {
      invItem.currentStock += line.quantity;
      invItem.purchasePrice = line.purchasePrice;
      await invItem.save();
      await StockTransaction.create({
        inventoryItem: invItem._id,
        type: "PURCHASE",
        quantity: line.quantity,
        purchase: purchase._id,
        createdBy: req.user._id,
      });
    }
  }

  await Supplier.findByIdAndUpdate(supplier, { $inc: { outstandingAmount: total } });

  res.status(201).json({ success: true, message: "Purchase recorded successfully", data: purchase });
}

async function updatePaymentStatus(req, res) {
  const purchase = await Purchase.findByIdAndUpdate(req.params.id, { paymentStatus: req.body.paymentStatus }, { new: true });
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
  res.json({ success: true, message: "Purchase payment status updated", data: purchase });
}

module.exports = { list, create, updatePaymentStatus };
