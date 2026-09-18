const mongoose = require("mongoose");

const recipeIngredientSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    description: { type: String, trim: true },
    image: { type: String },
    price: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true },
    foodType: { type: String, enum: ["VEG", "NON_VEG", "EGG", "NA"], default: "NA" },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    recipe: { type: [recipeIngredientSchema], default: [] },
  },
  { timestamps: true }
);

menuItemSchema.index({ name: "text" });

module.exports = mongoose.model("MenuItem", menuItemSchema);
