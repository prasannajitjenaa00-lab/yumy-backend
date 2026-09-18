const KOT = require("../models/KOT");
const Order = require("../models/Order");
const generateKOTNumber = require("../utils/generateKOTNumber");
const { recordAudit } = require("../middleware/auditMiddleware");

const KOT_TRANSITIONS = {
  PENDING: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

function getIO(req) {
  return req.app.get("io");
}

async function list(req, res) {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;
  else query.status = { $ne: "SERVED" };
  const kots = await KOT.find(query).populate("table", "number zone").sort({ createdAt: 1 });
  res.json({ success: true, message: "OK", data: kots });
}

async function send(req, res) {
  const { orderId, itemIds } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (["DRAFT"].includes(order.orderStatus)) {
    order.orderStatus = "OPEN";
  }

  const selectedItems = itemIds && itemIds.length
    ? order.items.filter((i) => itemIds.includes(String(i._id)))
    : order.items.filter((i) => i.kotStatus === "PENDING");

  if (!selectedItems.length) {
    return res.status(400).json({ success: false, message: "No pending items to send to kitchen" });
  }

  const kotNumber = await generateKOTNumber();
  const kot = await KOT.create({
    kotNumber,
    order: order._id,
    table: order.table,
    orderType: order.orderType,
    items: selectedItems.map((i) => ({ menuItem: i.menuItem, name: i.name, quantity: i.quantity, notes: i.notes })),
    createdBy: req.user._id,
    status: "SENT",
    statusHistory: [{ previousStatus: "PENDING", newStatus: "SENT", changedBy: req.user._id }],
  });

  selectedItems.forEach((i) => { i.kotStatus = "SENT"; });
  if (order.orderStatus === "OPEN") order.orderStatus = "CONFIRMED";
  await order.save();

  getIO(req)?.emit("kot:new", kot);
  await recordAudit({ user: req.user, action: "CREATE", module: "KOT", recordId: kot._id, newValue: { kotNumber }, ip: req.ip });

  res.status(201).json({ success: true, message: "KOT sent to kitchen", data: kot });
}

async function updateStatus(req, res) {
  if (req.user?.role === "WAITER") {
    return res.status(403).json({ success: false, message: "Waiters are not authorized to update KOT status directly." });
  }
  const kot = await KOT.findById(req.params.id);
  if (!kot) return res.status(404).json({ success: false, message: "KOT not found" });
  const { status } = req.body;
  const allowed = KOT_TRANSITIONS[kot.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Cannot move KOT from ${kot.status} to ${status}` });
  }
  kot.statusHistory.push({ previousStatus: kot.status, newStatus: status, changedBy: req.user._id });
  kot.status = status;
  await kot.save();

  const order = await Order.findById(kot.order);
  if (order) {
    const kotItemIds = kot.items.map((i) => String(i.menuItem));
    order.items.forEach((i) => {
      if (kotItemIds.includes(String(i.menuItem))) i.kotStatus = status;
    });
    if (status === "PREPARING") order.orderStatus = "PREPARING";
    if (status === "READY" && order.items.every((i) => ["READY", "SERVED"].includes(i.kotStatus))) {
      order.orderStatus = "READY";
    }
    if (status === "SERVED" && order.items.every((i) => i.kotStatus === "SERVED")) {
      order.orderStatus = "SERVED";
    }
    await order.save();
  }

  getIO(req)?.emit("kot:status", { kotId: kot._id, kotNumber: kot.kotNumber, status });
  res.json({ success: true, message: `KOT status updated to ${status}`, data: kot });
}

module.exports = { list, send, updateStatus, KOT_TRANSITIONS };
