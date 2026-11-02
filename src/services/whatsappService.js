const Order = require("../models/Order");
const Setting = require("../models/Setting");
const env = require("../config/env");

/**
 * Normalizes a stored customer phone number into the digits-only, country-coded
 * format the Meta WhatsApp Cloud API expects (e.g. "919876543210").
 * Assumes WHATSAPP_DEFAULT_COUNTRY_CODE for bare 10-digit local numbers.
 */
function formatPhoneForWhatsApp(rawPhone) {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.length === 10) digits = `${env.WHATSAPP_DEFAULT_COUNTRY_CODE}${digits}`;
  if (!/^\d{11,15}$/.test(digits)) return null;
  return digits;
}

async function getRestaurantSetting() {
  return Setting.findOne({ key: "restaurant" });
}

async function resolveCollectionCounter(order) {
  if (order.counter && String(order.counter).trim()) return String(order.counter).trim();
  const setting = await getRestaurantSetting();
  return setting?.defaultCollectionCounter || "Counter 1";
}

async function resolveRestaurantName() {
  const setting = await getRestaurantSetting();
  return setting?.restaurantName || "Yummy Yards";
}

async function markFoodReadyNotification(orderId, patch) {
  const $set = {};
  Object.entries(patch).forEach(([key, value]) => {
    $set[`whatsappNotification.foodReady.${key}`] = value;
  });
  return Order.findByIdAndUpdate(orderId, { $set }, { new: true });
}

/**
 * Sends the approved "food_ready_notification" Utility template via the official
 * Meta WhatsApp Cloud API. Templates can be sent any time (they are exempt from the
 * 24-hour customer-service session window), so no session-window check is needed here.
 * Throws on failure; callers are responsible for persisting the error state.
 */
async function callMetaTemplateMessage({ to, templateName, languageCode, parameters }) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp Cloud API is not configured (missing access token or phone number id)");
  }

  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text: String(text) })),
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `WhatsApp API responded with status ${response.status}`;
    throw new Error(message);
  }

  const messageId = data?.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp API did not return a message id");
  return messageId;
}

/**
 * Sends the "food ready" WhatsApp notification for an order that has just
 * transitioned to READY. Safe to call multiple times for the same order:
 * an atomic claim on whatsappNotification.foodReady.status guarantees only
 * one in-flight send per order, so repeated clicks or request retries never
 * produce duplicate messages. Never throws - all failures are caught, logged
 * and persisted on the order so the READY status itself is never rolled back.
 *
 * @param {import("mongoose").Document} order - the saved Order doc (orderStatus must be READY)
 * @param {{ io?: import("socket.io").Server }} [opts] - optional socket.io server to emit live status updates
 * @returns {Promise<string|null>} the provider message id on success, otherwise null
 */
async function sendFoodReadyNotification(order, { io } = {}) {
  const orderId = order._id;

  // Atomic claim: only the first caller to see a non "sent"/"sending" status wins.
  // Any duplicate click or retry that lands after this will see null here and no-op.
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: "READY",
      "whatsappNotification.foodReady.status": { $nin: ["sent", "sending"] },
    },
    { $set: { "whatsappNotification.foodReady.status": "sending", "whatsappNotification.foodReady.error": null } },
    { new: true }
  ).populate("customer");

  if (!claimed) return null;

  const emit = (status, extra = {}) => {
    try {
      io?.emit("order:whatsapp", {
        orderId: String(orderId),
        orderNumber: claimed.orderNumber,
        status,
        ...extra,
      });
    } catch (emitErr) {
      console.error("[whatsapp] socket emit failed:", emitErr.message);
    }
  };

  const customer = claimed.customer;
  if (!customer) {
    await markFoodReadyNotification(orderId, { status: "skipped", error: "No customer linked to this order" });
    emit("skipped", { reason: "no_customer" });
    return null;
  }

  if (customer.whatsappOptIn === false) {
    await markFoodReadyNotification(orderId, { status: "skipped", error: "Customer has not consented to WhatsApp notifications" });
    emit("skipped", { reason: "no_consent" });
    return null;
  }

  const phone = formatPhoneForWhatsApp(customer.phone);
  if (!phone) {
    await markFoodReadyNotification(orderId, { status: "skipped", error: "Customer has no valid mobile number" });
    emit("skipped", { reason: "no_phone" });
    return null;
  }

  const [counter, restaurantName] = await Promise.all([
    resolveCollectionCounter(claimed),
    resolveRestaurantName(),
  ]);
  const customerName = customer.name || "Guest";

  try {
    const messageId = await callMetaTemplateMessage({
      to: phone,
      templateName: env.WHATSAPP_FOOD_READY_TEMPLATE,
      languageCode: env.WHATSAPP_TEMPLATE_LANGUAGE,
      parameters: [customerName, claimed.orderNumber, counter, restaurantName],
    });

    await markFoodReadyNotification(orderId, { status: "sent", messageId, sentAt: new Date(), error: null });
    emit("sent", { messageId });
    return messageId;
  } catch (err) {
    console.error(`[whatsapp] Failed to send food-ready notification for order ${claimed.orderNumber}:`, err.message);
    await markFoodReadyNotification(orderId, { status: "failed", error: err.message });
    emit("failed", { error: err.message });
    return null;
  }
}

/**
 * Applies a WhatsApp delivery-status webhook update (sent/delivered/read/failed)
 * from Meta to the order that owns the matching provider message id.
 */
async function applyDeliveryStatusUpdate({ messageId, status, errorMessage }) {
  if (!messageId) return null;
  const mapped = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" }[status];
  if (!mapped) return null;

  const order = await Order.findOne({ "whatsappNotification.foodReady.messageId": messageId });
  if (!order) return null;

  // Never downgrade a terminal "read" status back to "delivered", etc.
  const rank = { sending: 0, sent: 1, delivered: 2, read: 3, failed: 4, skipped: 4 };
  const current = order.whatsappNotification?.foodReady?.status;
  if (rank[current] !== undefined && rank[mapped] !== undefined && rank[mapped] < rank[current]) {
    return order;
  }

  return markFoodReadyNotification(order._id, {
    status: mapped,
    ...(errorMessage ? { error: errorMessage } : {}),
  });
}

module.exports = {
  sendFoodReadyNotification,
  applyDeliveryStatusUpdate,
  formatPhoneForWhatsApp,
};
