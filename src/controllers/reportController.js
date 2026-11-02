const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const PettyCash = require("../models/PettyCash");
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
  const payments = await Payment.find({ createdAt: { $gte: start, $lte: end }, isRefund: false })
    .populate("order", "orderNumber orderType grandTotal")
    .populate("receivedBy", "name")
    .sort({ createdAt: -1 });

  const summary = {
    CASH: { amount: 0, count: 0, percentage: 0 },
    UPI: { amount: 0, count: 0, percentage: 0 },
    CARD: { amount: 0, count: 0, percentage: 0 },
    OTHER: { amount: 0, count: 0, percentage: 0 },
  };

  let totalCollected = 0;
  payments.forEach((p) => {
    const method = summary[p.method] ? p.method : "OTHER";
    summary[method].amount = round2(summary[method].amount + p.amount);
    summary[method].count += 1;
    totalCollected = round2(totalCollected + p.amount);
  });

  Object.keys(summary).forEach((k) => {
    summary[k].percentage = totalCollected > 0 ? round2((summary[k].amount / totalCollected) * 100) : 0;
  });

  // Petty Cash transactions for drawer reconciliation
  const pettyTransactions = await PettyCash.find({ createdAt: { $gte: start, $lte: end } });
  const totalPettyIn = round2(pettyTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
  const totalPettyOut = round2(pettyTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));
  const netPetty = round2(totalPettyIn - totalPettyOut);

  const cashSales = summary.CASH.amount;
  const netDrawerCash = round2(cashSales + netPetty);

  res.json({
    success: true,
    message: "OK",
    data: {
      // Direct keys for backward compatibility
      CASH: summary.CASH.amount,
      UPI: summary.UPI.amount,
      CARD: summary.CARD.amount,
      OTHER: summary.OTHER.amount,
      totalCollected,
      totalCount: payments.length,
      summary,
      pettyCash: {
        totalCashIn: totalPettyIn,
        totalCashOut: totalPettyOut,
        net: netPetty,
        cashSales,
        netDrawerCash,
      },
      transactions: payments.slice(0, 100).map((p) => ({
        id: p._id,
        orderId: p.order?._id,
        orderNumber: p.order?.orderNumber || "N/A",
        orderType: p.order?.orderType || "DINE_IN",
        amount: p.amount,
        method: p.method,
        transactionRef: p.transactionRef || "",
        cashier: p.receivedBy?.name || "Staff",
        paidAt: p.paidAt || p.createdAt,
      })),
    },
  });
}

async function pettyCashReport(req, res) {
  const { start, end } = dateRange(req);
  const transactions = await PettyCash.find({ createdAt: { $gte: start, $lte: end } })
    .populate("paidBy", "name email role")
    .sort({ createdAt: -1 });

  const totalCashIn = round2(transactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
  const totalCashOut = round2(transactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));
  const netBalance = round2(totalCashIn - totalCashOut);

  const byCategory = {};
  transactions
    .filter((t) => t.type === "CASH_OUT")
    .forEach((t) => {
      byCategory[t.category] = round2((byCategory[t.category] || 0) + t.amount);
    });

  res.json({
    success: true,
    message: "OK",
    data: {
      totalCashIn,
      totalCashOut,
      netBalance,
      totalTransactions: transactions.length,
      byCategory,
      transactions,
    },
  });
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

  const KOT = require("../models/KOT");
  const pendingKots = await KOT.countDocuments({ status: { $in: ["PENDING", "SENT", "ACCEPTED"] } });
  const preparingCount = await KOT.countDocuments({ status: "PREPARING" });
  const readyCount = await KOT.countDocuments({ status: "READY" });
  const preparingOrders = Math.max(preparingCount, todaysOrders.filter((o) => o.orderStatus === "PREPARING").length);
  const readyOrders = Math.max(readyCount, todaysOrders.filter((o) => o.orderStatus === "READY").length);

  res.json({
    success: true,
    message: "OK",
    data: {
      todaysSales,
      todaysOrders: todaysOrders.length,
      todaysProfit: round2(todaysSales - expensesTotal),
      activeTables,
      availableTables,
      pendingKots,
      preparingOrders,
      readyOrders,
      unpaidOrders: todaysOrders.filter((o) => o.paymentStatus === "UNPAID").length,
      lowStockItems,
      todaysExpenses: expensesTotal,
    },
  });
}

module.exports = { salesReport, orderReport, paymentReport, pettyCashReport, inventoryReport, productReport, gstReport, dashboard };
