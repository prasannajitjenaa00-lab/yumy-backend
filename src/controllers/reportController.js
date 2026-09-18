const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const InventoryItem = require("../models/InventoryItem");
const StockTransaction = require("../models/StockTransaction");
const { startOfDay, endOfDay } = require("../utils/dateUtils");
const { round2 } = require("../utils/calculations");

function dateRange(req) {
  const { from, to } = req.query;
  const start = from ? startOfDay(new Date(from)) : startOfDay(new Date());
  const end = to ? endOfDay(new Date(to)) : endOfDay(new Date());
  return { start, end };
}

async function salesReport(req, res) {
  const { start, end } = dateRange(req);
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, orderStatus: { $ne: "CANCELLED" } });
  const totalSales = round2(orders.reduce((s, o) => s + o.grandTotal, 0));
  const totalOrders = orders.length;
  const byDay = {};
  orders.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    byDay[key] = round2((byDay[key] || 0) + o.grandTotal);
  });
  res.json({ success: true, message: "OK", data: { totalSales, totalOrders, byDay } });
}

async function orderReport(req, res) {
  const { start, end } = dateRange(req);
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end } });
  const summary = {
    total: orders.length,
    dineIn: orders.filter((o) => o.orderType === "DINE_IN").length,
    takeaway: orders.filter((o) => o.orderType === "TAKEAWAY").length,
    delivery: orders.filter((o) => o.orderType === "DELIVERY").length,
    cancelled: orders.filter((o) => o.orderStatus === "CANCELLED").length,
  };
  res.json({ success: true, message: "OK", data: summary });
}

async function paymentReport(req, res) {
  const { start, end } = dateRange(req);
  const payments = await Payment.find({ createdAt: { $gte: start, $lte: end }, isRefund: false });
  const byMethod = { CASH: 0, UPI: 0, CARD: 0, OTHER: 0 };
  payments.forEach((p) => { byMethod[p.method] = round2((byMethod[p.method] || 0) + p.amount); });
  res.json({ success: true, message: "OK", data: byMethod });
}

async function inventoryReport(req, res) {
  const items = await InventoryItem.find();
  const lowStock = items.filter((i) => i.currentStock <= i.minimumStock);
  const stockValuation = round2(items.reduce((s, i) => s + i.currentStock * i.purchasePrice, 0));
  const { start, end } = dateRange(req);
  const wastage = await StockTransaction.find({ type: "WASTAGE", createdAt: { $gte: start, $lte: end } }).populate("inventoryItem", "name unit");
  res.json({ success: true, message: "OK", data: { totalItems: items.length, lowStock, stockValuation, wastage } });
}

async function productReport(req, res) {
  const { start, end } = dateRange(req);
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, orderStatus: { $ne: "CANCELLED" } });
  const tally = {};
  orders.forEach((o) => {
    o.items.forEach((i) => {
      const key = i.name;
      if (!tally[key]) tally[key] = { name: key, quantity: 0, revenue: 0 };
      tally[key].quantity += i.quantity;
      tally[key].revenue = round2(tally[key].revenue + i.price * i.quantity);
    });
  });
  const list = Object.values(tally).sort((a, b) => b.revenue - a.revenue);
  res.json({ success: true, message: "OK", data: { bestSelling: list.slice(0, 10), lowSelling: list.slice(-10).reverse() } });
}

async function gstReport(req, res) {
  const { start, end } = dateRange(req);
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, orderStatus: { $ne: "CANCELLED" } });
  const taxableSales = round2(orders.reduce((s, o) => s + o.subtotal - o.discount, 0));
  const gstCollected = round2(orders.reduce((s, o) => s + o.taxAmount, 0));
  res.json({
    success: true,
    message: "OK",
    data: {
      taxableSales,
      gstCollected,
      cgst: round2(gstCollected / 2),
      sgst: round2(gstCollected / 2),
      igst: 0,
    },
  });
}

async function dashboard(req, res) {
  const start = startOfDay();
  const end = endOfDay();
  const todaysOrders = await Order.find({ createdAt: { $gte: start, $lte: end } });
  const paidOrders = todaysOrders.filter((o) => o.orderStatus !== "CANCELLED");
  const todaysSales = round2(paidOrders.reduce((s, o) => s + o.grandTotal, 0));
  const todaysExpenses = await Expense.find({ date: { $gte: start, $lte: end } });
  const expensesTotal = round2(todaysExpenses.reduce((s, e) => s + e.amount, 0));

  const activeTables = await require("../models/Table").countDocuments({ status: "OCCUPIED" });
  const availableTables = await require("../models/Table").countDocuments({ status: "AVAILABLE" });
  const lowStockItems = await InventoryItem.countDocuments({ $expr: { $lte: ["$currentStock", "$minimumStock"] } });

  res.json({
    success: true,
    message: "OK",
    data: {
      todaysSales,
      todaysOrders: todaysOrders.length,
      todaysProfit: round2(todaysSales - expensesTotal),
      activeTables,
      availableTables,
      pendingKots: await require("../models/KOT").countDocuments({ status: { $in: ["PENDING", "SENT"] } }),
      preparingOrders: todaysOrders.filter((o) => o.orderStatus === "PREPARING").length,
      readyOrders: todaysOrders.filter((o) => o.orderStatus === "READY").length,
      unpaidOrders: todaysOrders.filter((o) => o.paymentStatus === "UNPAID").length,
      lowStockItems,
      todaysExpenses: expensesTotal,
    },
  });
}

module.exports = { salesReport, orderReport, paymentReport, inventoryReport, productReport, gstReport, dashboard };
