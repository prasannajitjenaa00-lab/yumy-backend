require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");

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
  {
    name: "Malai Kofta",
    categoryName: "Main Course",
    price: 260,
    foodType: "VEG",
    description: "Deep fried paneer & potato dumplings served in a rich cashew nut gravy.",
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80",
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
  {
    name: "Jeera Rice",
    categoryName: "Rice & Biryani",
    price: 140,
    foodType: "VEG",
    description: "Steamed basmati rice tempered with ghee and roasted cumin seeds.",
    image: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=500&auto=format&fit=crop&q=80",
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
  {
    name: "Tandoori Roti",
    categoryName: "Breads & Naan",
    price: 30,
    foodType: "VEG",
    description: "Whole wheat flatbread baked in traditional clay tandoor.",
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80",
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
    name: "Fresh Lime Soda",
    categoryName: "Beverages",
    price: 70,
    foodType: "VEG",
    description: "Chilled sparkling soda flavored with fresh lime juice and mint.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80",
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
  {
    name: "Sizzling Brownie with Ice Cream",
    categoryName: "Desserts",
    price: 160,
    foodType: "VEG",
    description: "Hot chocolate brownie served on sizzling platter topped with vanilla ice cream.",
    image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=500&auto=format&fit=crop&q=80",
  },
];

async function seedMoreMenu() {
  // Safety Guard: Prevent running in production unless explicitly opted in via ALLOW_SAFE_SEED
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SAFE_SEED !== "true") {
    console.warn("\n====================================================================");
    console.warn("[seedMoreMenu] WARNING: Blocked in production (NODE_ENV=production)");
    console.warn("[seedMoreMenu] to safeguard live restaurant data.");
    console.warn("[seedMoreMenu] Set ALLOW_SAFE_SEED=true to explicitly allow non-destructive seeding.");
    console.warn("====================================================================\n");
    process.exit(0);
  }

  await connectDB();
  console.log("[seedMoreMenu] Seeding missing menu items safely (non-destructive)...");

  // Ensure categories exist without overwriting
  const categoryNames = [
    "Starters",
    "Main Course",
    "Rice & Biryani",
    "Breads & Naan",
    "Chinese & Indo-Chinese",
    "Beverages",
    "Desserts",
  ];

  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, sortOrder: i, isActive: true } },
      { upsert: true, new: true }
    );
  }

  const allCategories = await Category.find({});
  const catMap = Object.fromEntries(allCategories.map((c) => [c.name, c._id]));

  let added = 0;
  for (const item of DUMMY_MENU) {
    const catId = catMap[item.categoryName];
    if (!catId) continue;

    // Use $setOnInsert so existing item prices, descriptions, or modifications are never overwritten
    const result = await MenuItem.findOneAndUpdate(
      { name: item.name },
      {
        $setOnInsert: {
          name: item.name,
          category: catId,
          price: item.price,
          taxPercent: 5,
          foodType: item.foodType,
          description: item.description,
          image: item.image,
          isAvailable: true,
          isActive: true,
        },
      },
      { upsert: true, new: false }
    );
    if (!result) {
      added++;
    }
  }

  console.log(`[seedMoreMenu] Successfully added ${added} missing menu items (existing items were preserved)!`);
  await mongoose.disconnect();
  process.exit(0);
}

seedMoreMenu().catch((err) => {
  console.error("[seedMoreMenu] Failed:", err);
  process.exit(1);
});
