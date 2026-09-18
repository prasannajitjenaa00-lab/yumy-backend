const Payment = require("../models/Payment");
const Order = require("../models/Order");
const Table = require("../models/Table");
const { recordAudit } = require("../middleware/auditMiddleware");
const { round2 } = require("../utils/calculations");

function getIO(req) {
  return req.app.get("io");
}

async function totalPaid(orderId) {
  const payments = await Payment.find({ order: orderId, isRefund: false });
  return round2(payments.reduce((sum, p) => sum + p.amount, 0));
}

async function totalRefunded(orderId) {
  const refunds = await Payment.find({ order: orderId, isRefund: true });
  return round2(refunds.reduce((sum, p) => sum + p.amount, 0));
}

async function recordPayment(req, res) {
  const { orderId, amount, method, transactionRef, cashReceived } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (order.paymentStatus === "PAID") {
    return res.status(400).json({ success: false, message: "Order is already fully paid" });
  }
  if (order.paymentStatus === "VOID" || order.orderStatus === "CANCELLED") {
    return res.status(400).json({ success: false, message: "Cannot record payment for a cancelled/void order" });
  }

  const changeReturned = method === "CASH" && cashReceived ? round2(Math.max(0, cashReceived - amount)) : undefined;

  const payment = await Payment.create({
    order: order._id,
    amount,
    method,
    transactionRef,
    cashReceived,
    changeReturned,
    receivedBy: req.user._id,
  });

  const paid = await totalPaid(order._id);
  const isFullyPaid = paid >= order.grandTotal;
  order.paymentStatus = isFullyPaid ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
  
  if (isFullyPaid) {
    order.billStatus = "PAID";
    order.orderStatus = "COMPLETED";
  }
  
  await order.save();

  if (isFullyPaid) {
    if (order.table) {
      await Table.findByIdAndUpdate(order.table, { status: "AVAILABLE", currentOrder: null });
      getIO(req)?.emit("table:update", { tableId: order.table, status: "AVAILABLE" });
    }
    try {
      const { deductInventoryForOrder } = require("./orderController");
      await deductInventoryForOrder(order, req.user._id);
    } catch (err) {
      console.error("Inventory deduction error:", err);
    }
    getIO(req)?.emit("order:status", { orderId: order._id, orderNumber: order.orderNumber, status: "COMPLETED" });
  }

  getIO(req)?.emit("payment:new", { orderId: order._id, paymentStatus: order.paymentStatus });
  await recordAudit({ user: req.user, action: "PAYMENT", module: "PAYMENTS", recordId: payment._id, newValue: { amount, method }, ip: req.ip });

  res.status(201).json({ success: true, message: "Payment recorded successfully", data: { payment, paymentStatus: order.paymentStatus, changeReturned } });
}

async function recordRefund(req, res) {
  const { orderId, amount, method, reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: "Refund reason is required" });
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const paid = await totalPaid(order._id);
  if (amount > paid) return res.status(400).json({ success: false, message: "Refund amount cannot exceed amount paid" });

  const refund = await Payment.create({
    order: order._id,
    amount,
    method,
    isRefund: true,
    refundReason: reason,
    receivedBy: req.user._id,
  });

  const refunded = await totalRefunded(order._id);
  order.paymentStatus = refunded >= paid ? "REFUNDED" : "PARTIALLY_REFUNDED";
  await order.save();

  await recordAudit({ user: req.user, action: "REFUND", module: "PAYMENTS", recordId: refund._id, newValue: { amount, reason }, ip: req.ip });
  getIO(req)?.emit("payment:refund", { orderId: order._id, paymentStatus: order.paymentStatus });

  res.status(201).json({ success: true, message: "Refund recorded successfully", data: { refund, paymentStatus: order.paymentStatus } });
}

async function listByOrder(req, res) {
  const payments = await Payment.find({ order: req.params.orderId }).populate("receivedBy", "name role").sort({ createdAt: 1 });
  res.json({ success: true, message: "OK", data: payments });
}

module.exports = { recordPayment, recordRefund, listByOrder, totalPaid };
