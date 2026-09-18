const MenuItem = require("../models/MenuItem");
const makeCrudController = require("../utils/crudFactory");

const base = makeCrudController(MenuItem, "MENU", { searchFields: ["name", "sku"], populate: ["category", "recipe.inventoryItem"] });

async function toggleAvailability(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });
  item.isAvailable = !item.isAvailable;
  await item.save();
  res.json({ success: true, message: "Availability updated", data: item });
}

module.exports = { ...base, toggleAvailability };
