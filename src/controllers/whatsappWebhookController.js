const crypto = require("crypto");
const env = require("../config/env");
const { applyDeliveryStatusUpdate } = require("../services/whatsappService");

// Bounded in-memory dedupe cache: Meta retries webhook deliveries aggressively
// (e.g. if our 200 response is slow or dropped), so the same event can arrive
// more than once. Keyed per event so re-deliveries are skipped without re-processing.
const MAX_DEDUPE_ENTRIES = 2000;
const seenEventKeys = new Map();

function alreadyProcessed(key) {
  if (seenEventKeys.has(key)) return true;
  seenEventKeys.set(key, Date.now());
  if (seenEventKeys.size > MAX_DEDUPE_ENTRIES) {
    const oldestKey = seenEventKeys.keys().next().value;
    seenEventKeys.delete(oldestKey);
  }
  return false;
}

// Never log a full phone number - only enough to spot-check in logs.
function maskPhone(phone) {
  if (!phone) return "unknown";
  const str = String(phone);
  if (str.length <= 4) return "*".repeat(str.length);
  return `${str.slice(0, 2)}${"*".repeat(str.length - 4)}${str.slice(-2)}`;
}

/**
 * GET /api/webhooks/whatsapp
 * Meta calls this once, at setup time (and whenever the subscription is re-verified),
 * to confirm we own this callback URL.
 */
function verify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[whatsapp] webhook verification succeeded");
    return res.status(200).type("text/plain").send(String(challenge ?? ""));
  }

  console.warn("[whatsapp] webhook verification failed: mode or token mismatch");
  return res.sendStatus(403);
}

// Confirms the request genuinely came from Meta by checking the HMAC SHA-256 signature
// Meta signs every webhook payload with, using our app secret. Skipped (allowed through)
// only when WHATSAPP_APP_SECRET isn't configured, so local/dev setups aren't blocked.
function isValidSignature(req) {
  if (!env.WHATSAPP_APP_SECRET) return true;
  const signatureHeader = req.get("X-Hub-Signature-256");
  if (!signatureHeader || !req.rawBody) return false;

  const expected = `sha256=${crypto.createHmac("sha256", env.WHATSAPP_APP_SECRET).update(req.rawBody).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false; // mismatched buffer lengths etc.
  }
}

async function handleStatusUpdate(statusUpdate) {
  const dedupeKey = `status:${statusUpdate.id}:${statusUpdate.status}`;
  if (alreadyProcessed(dedupeKey)) {
    console.log(`[whatsapp] duplicate status webhook ignored - messageId=${statusUpdate.id} status=${statusUpdate.status}`);
    return;
  }

  const errorDetail = statusUpdate.errors?.[0];
  console.log(
    `[whatsapp] status update - messageId=${statusUpdate.id} status=${statusUpdate.status} recipient=${maskPhone(statusUpdate.recipient_id)}` +
      (errorDetail ? ` error="${errorDetail.title}"` : "")
  );

  await applyDeliveryStatusUpdate({
    messageId: statusUpdate.id,
    status: statusUpdate.status,
    errorMessage: errorDetail?.title || null,
  });
}

async function handleIncomingMessage(message) {
  const dedupeKey = `message:${message.id}`;
  if (alreadyProcessed(dedupeKey)) {
    console.log(`[whatsapp] duplicate incoming message webhook ignored - messageId=${message.id}`);
    return;
  }

  // We only send outbound utility notifications today; inbound replies are logged
  // (for visibility / future support-reply handling) but not auto-responded to.
  console.log(`[whatsapp] incoming message - messageId=${message.id} type=${message.type} from=${maskPhone(message.from)}`);
}

/**
 * POST /api/webhooks/whatsapp
 * Meta posts both inbound customer messages and outbound delivery-status
 * updates (sent/delivered/read/failed) to this single endpoint.
 */
async function receive(req, res) {
  if (!isValidSignature(req)) {
    console.warn("[whatsapp] webhook signature verification failed");
    return res.sendStatus(403);
  }

  // Acknowledge immediately; Meta retries aggressively on anything but a fast 200.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses || [];
        const messages = change.value?.messages || [];

        for (const statusUpdate of statuses) {
          try {
            await handleStatusUpdate(statusUpdate);
          } catch (err) {
            console.error(`[whatsapp] failed to process status update for messageId=${statusUpdate.id}:`, err.message);
          }
        }

        for (const message of messages) {
          try {
            await handleIncomingMessage(message);
          } catch (err) {
            console.error(`[whatsapp] failed to process incoming message id=${message.id}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp] webhook processing error:", err.message);
  }
}

module.exports = { verify, receive };
