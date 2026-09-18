const AuditLog = require("../models/AuditLog");

async function recordAudit({ user, action, module: moduleName, recordId, oldValue, newValue, ip }) {
  try {
    await AuditLog.create({
      user: user ? user._id || user : null,
      action,
      module: moduleName,
      recordId: recordId ? String(recordId) : undefined,
      oldValue,
      newValue,
      ip,
    });
  } catch (err) {
    console.error("[audit] failed to record:", err.message);
  }
}

module.exports = { recordAudit };
