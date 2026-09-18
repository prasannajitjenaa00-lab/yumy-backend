const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    module: { type: String, required: true },
    recordId: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
