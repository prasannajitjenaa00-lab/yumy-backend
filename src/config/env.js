require("dotenv").config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yummy-yards",
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  OWNER_EMAIL: process.env.OWNER_EMAIL || "owner@example.com",
  OWNER_PASSWORD: process.env.OWNER_PASSWORD || "change_this_password",
  OWNER_NAME: process.env.OWNER_NAME || "Restaurant Owner",
};

module.exports = env;
