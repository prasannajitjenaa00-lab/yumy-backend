const mongoose = require("mongoose");
const dns = require("dns");

// Fallback DNS servers to resolve MongoDB Atlas SRV records reliably across all networks
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yummy-yards";
    await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

