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

  // Meta WhatsApp Cloud API (official) - used for the "food ready" utility template notification
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || "",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  // Reserved for future use (template management / embedded signup APIs) - not required to send messages today.
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",

  // Meta App credentials - WHATSAPP_APP_SECRET is used to verify the X-Hub-Signature-256 header
  // on incoming webhook calls so only genuine Meta requests can update delivery status.
  WHATSAPP_APP_ID: process.env.WHATSAPP_APP_ID || "",
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || "",

  // Webhook verification (the GET /webhook handshake challenge token you set in the Meta App dashboard)
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "",

  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || "v20.0",
  WHATSAPP_FOOD_READY_TEMPLATE: process.env.WHATSAPP_FOOD_READY_TEMPLATE || "food_ready_notification",
  WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
  WHATSAPP_DEFAULT_COUNTRY_CODE: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91",
};

module.exports = env;
