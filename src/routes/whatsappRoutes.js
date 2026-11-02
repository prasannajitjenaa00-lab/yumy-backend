const router = require("express").Router();
const ctrl = require("../controllers/whatsappWebhookController");

// Public endpoint: Meta's servers call this directly (no user auth), secured by the
// verify-token handshake (GET) and the X-Hub-Signature-256 HMAC check (POST).
router.get("/whatsapp", ctrl.verify);
router.post("/whatsapp", ctrl.receive);

module.exports = router;
