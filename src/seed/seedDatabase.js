require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../config/env");
const connectDB = require("../config/db");

const User = require("../models/User");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const InventoryItem = require("../models/InventoryItem");
const Setting = require("../models/Setting");

const DUMMY_MENU = [
  // Starters
  {
    name: "Paneer Tikka",
    categoryName: "Starters",
    price: 240,
    foodType: "VEG",
    description: "Cubes of cottage cheese marinated in spiced yogurt and grilled in tandoor.",
    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Chicken 65",
    categoryName: "Starters",
    price: 270,
    foodType: "NON_VEG",
    description: "Spicy deep-fried chicken starter coated with South Indian spices and curry leaves.",
    image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Crispy Corn",
    categoryName: "Starters",
    price: 190,
    foodType: "VEG",
    description: "Deep fried sweet corn tossed with bell peppers, chili, and cilantro.",
    image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Tandoori Chicken (Half)",
    categoryName: "Starters",
    price: 320,
    foodType: "NON_VEG",
    description: "Classic Indian roasted chicken marinated in yogurt and aromatic spices.",
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Fish Amritsari",
    categoryName: "Starters",
    price: 340,
    foodType: "NON_VEG",
    description: "Punjabi style carom-seed and gram flour battered crispy fried fish.",
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
  },

  // Main Course
  {
    name: "Paneer Butter Masala",
    categoryName: "Main Course",
    price: 280,
    foodType: "VEG",
    description: "Rich and creamy tomato gravy cooked with succulent cottage cheese cubes.",
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Butter Chicken",
    categoryName: "Main Course",
    price: 340,
    foodType: "NON_VEG",
    description: "Tender tandoori chicken cooked in a velvety tomato, butter, and cream sauce.",
    image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Dal Makhani",
    categoryName: "Main Course",
    price: 220,
    foodType: "VEG",
    description: "Slow cooked black lentils simmered overnight with butter, cream, and spices.",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Kadhai Chicken",
    categoryName: "Main Course",
    price: 320,
    foodType: "NON_VEG",
    description: "Chicken cooked with freshly ground kadhai masala, capsicum, and onions.",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80",
  },

  // Rice & Biryani
  {
    name: "Hyderabadi Chicken Biryani",
    categoryName: "Rice & Biryani",
    price: 320,
    foodType: "NON_VEG",
    description: "Fragrant long-grain basmati rice layered with spiced marinated chicken.",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Mutton Dum Biryani",
    categoryName: "Rice & Biryani",
    price: 420,
    foodType: "NON_VEG",
    description: "Slow-cooked tender mutton with saffron infused basmati rice.",
    image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Veg Dum Biryani",
    categoryName: "Rice & Biryani",
    price: 240,
    foodType: "VEG",
    description: "Assorted garden vegetables dum-cooked with fragrant basmati rice.",
    image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&auto=format&fit=crop&q=80",
  },

  // Breads & Naan
  {
    name: "Butter Naan",
    categoryName: "Breads & Naan",
    price: 50,
    foodType: "VEG",
    description: "Traditional soft tandoori flatbread brushed with fresh butter.",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Garlic Naan",
    categoryName: "Breads & Naan",
    price: 65,
    foodType: "VEG",
    description: "Leavened flatbread topped with minced garlic, butter, and coriander.",
    image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80",
  },

  // Chinese & Indo-Chinese
  {
    name: "Hakka Noodles",
    categoryName: "Chinese & Indo-Chinese",
    price: 190,
    foodType: "VEG",
    description: "Stir-fried noodles tossed with crunchy shredded vegetables and soy sauce.",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Chilli Chicken",
    categoryName: "Chinese & Indo-Chinese",
    price: 260,
    foodType: "NON_VEG",
    description: "Crispy fried chicken chunks tossed in spicy chili-garlic soy gravy.",
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&auto=format&fit=crop&q=80",
  },

  // Beverages
  {
    name: "Mango Lassi",
    categoryName: "Beverages",
    price: 90,
    foodType: "VEG",
    description: "Refreshing chilled sweet yogurt drink blended with Alphonso mango pulp.",
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Masala Chai",
    categoryName: "Beverages",
    price: 40,
    foodType: "VEG",
    description: "Traditional Indian spiced tea brewed with milk and cardamom.",
    image: "https://images.unsplash.com/photo-1571934811356-5cc561d6821f?w=500&auto=format&fit=crop&q=80",
  },

  // Desserts
  {
    name: "Gulab Jamun (2 pc)",
    categoryName: "Desserts",
    price: 80,
    foodType: "VEG",
    description: "Warm soft milk-solid fried dumplings soaked in cardamom sugar syrup.",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Rasmalai (2 pc)",
    categoryName: "Desserts",
    price: 110,
    foodType: "VEG",
    description: "Spongy cottage cheese patties soaked in chilled saffron cardamom milk.",
    image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80",
  },
];

async function seed() {
  await connectDB();
  console.log("[seed] Clearing demo collections...");
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    MenuItem.deleteMany({}),
    Table.deleteMany({}),
    InventoryItem.deleteMany({}),
    Setting.deleteMany({}),
  ]);

  console.log("[seed] Creating settings...");
  await Setting.create({
    key: "restaurant",
    restaurantName: "Yummy Yards",
    address: "Janpath, Bhubaneswar, Odisha",
    phone: "+91-9000000000",
    gstin: "21ABCDE1234F1Z5",
    gstPercent: 5,
    cgstPercent: 2.5,
    sgstPercent: 2.5,
    tableCount: 20,
  });

  console.log("[seed] Creating users (DEMO)...");
  await User.create([
    { name: env.OWNER_NAME, email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD, role: "OWNER" },
    { name: "Demo Manager", email: "manager@example.com", password: "manager123", role: "MANAGER" },
    { name: "Demo Cashier", email: "cashier@example.com", password: "cashier123", role: "CASHIER" },
    { name: "Demo Kitchen", email: "kitchen@example.com", password: "kitchen123", role: "KITCHEN" },
  ]);

  console.log("[seed] Creating categories & menu (DEMO)...");
  const categoryNames = [
    "Starters",
    "Main Course",
    "Rice & Biryani",
    "Breads & Naan",
    "Chinese & Indo-Chinese",
    "Beverages",
    "Desserts",
  ];
  const categories = await Category.create(categoryNames.map((name, i) => ({ name, sortOrder: i })));
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  for (const item of DUMMY_MENU) {
    const catId = catMap[item.categoryName];
    if (catId) {
      await MenuItem.create({
        name: item.name,
        category: catId,
        price: item.price,
        taxPercent: 5,
        foodType: item.foodType,
        description: item.description,
        image: item.image,
        isAvailable: true,
        isActive: true,
      });
    }
  }

  console.log("[seed] Creating tables (DEMO)...");
  const tableDocs = [];
  for (let i = 1; i <= 20; i += 1) {
    const zone = i <= 10 ? "Main Hall" : i <= 16 ? "Garden" : "Terrace";
    tableDocs.push({ number: i, zone, capacity: 4 });
  }
  await Table.create(tableDocs);

  console.log("[seed] Done. Demo login credentials:");
  console.log(`  OWNER    ${env.OWNER_EMAIL} / ${env.OWNER_PASSWORD}`);
  console.log("  MANAGER  manager@example.com / manager123");
  console.log("  CASHIER  cashier@example.com / cashier123");
  console.log("  KITCHEN  kitchen@example.com / kitchen123");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
