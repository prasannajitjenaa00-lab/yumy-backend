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

  // 1. By Day: Pre-fill all dates in selected dateRange
  const byDay = {};
  const cur = new Date(start);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    byDay[key] = 0;
    cur.setDate(cur.getDate() + 1);
  }

  // 2. By Hour: For today / single day view
  const byHour = {};
  for (let h = 8; h <= 23; h++) {
    const hourLabel = `${String(h).padStart(2, "0")}:00`;
    byHour[hourLabel] = 0;
  }

  orders.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    byDay[key] = round2((byDay[key] || 0) + o.grandTotal);

    const h = o.createdAt.getHours();
    const hourLabel = `${String(h).padStart(2, "0")}:00`;
    if (byHour[hourLabel] !== undefined) {
      byHour[hourLabel] = round2(byHour[hourLabel] + o.grandTotal);
    }
  });

  // 3. Always include Last 7 Days continuous trend
  const past7Days = {};
  const d7 = new Date();
  d7.setDate(d7.getDate() - 6);
  const start7 = startOfDay(d7);
  const end7 = endOfDay(new Date());

  const orders7 = await Order.find({ createdAt: { $gte: start7, $lte: end7 }, orderStatus: { $ne: "CANCELLED" } });
  const c7 = new Date(start7);
  while (c7 <= end7) {
    const key = c7.toISOString().slice(0, 10);
    past7Days[key] = 0;
    c7.setDate(c7.getDate() + 1);
  }
  orders7.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (past7Days[key] !== undefined) {
      past7Days[key] = round2(past7Days[key] + o.grandTotal);
    }
  });

  // 4. Always include Last 30 Days continuous trend
  const past30Days = {};
  const d30 = new Date();
  d30.setDate(d30.getDate() - 29);
  const start30 = startOfDay(d30);
  const end30 = endOfDay(new Date());

  const orders30 = await Order.find({ createdAt: { $gte: start30, $lte: end30 }, orderStatus: { $ne: "CANCELLED" } });
  const c30 = new Date(start30);
  while (c30 <= end30) {
    const key = c30.toISOString().slice(0, 10);
    past30Days[key] = 0;
    c30.setDate(c30.getDate() + 1);
  }
  orders30.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (past30Days[key] !== undefined) {
      past30Days[key] = round2(past30Days[key] + o.grandTotal);
    }
  });

  res.json({
    success: true,
    message: "OK",
    data: {
      totalSales,
      totalOrders,
      byDay,
      byHour,
      past7Days,
      past30Days,
    },
  });
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
  const allPastTx = await PettyCash.find({ createdAt: { $lt: start } });
  const allPastPayments = await Payment.find({ createdAt: { $lt: start }, method: "CASH" });

  const pastCashSales = allPastPayments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const pastCashRefunds = allPastPayments.filter((p) => p.isRefund).reduce((s, p) => s + p.amount, 0);
  const pastPettyIn = allPastTx.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
  const pastPettyOut = allPastTx.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);

  const openingBalance = round2(pastCashSales + pastPettyIn - pastCashRefunds - pastPettyOut);

  const transactions = await PettyCash.find({ createdAt: { $gte: start, $lte: end } })
    .populate("paidBy", "name email role")
    .sort({ createdAt: 1 });
  const periodPayments = await Payment.find({ createdAt: { $gte: start, $lte: end }, method: "CASH" })
    .populate("receivedBy", "name email role");

  const totalCashSales = round2(periodPayments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0));
  const totalPettyIn = round2(transactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
  const totalPettyOut = round2(transactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));
  const closingBalance = round2(openingBalance + totalCashSales + totalPettyIn - totalPettyOut);

  const byCategory = {};
  transactions
    .filter((t) => t.type === "CASH_OUT")
    .forEach((t) => {
      byCategory[t.category] = round2((byCategory[t.category] || 0) + t.amount);
    });

  // Daily carry-forward ledger calculation (combining cash sales + petty cash in/out)
  const dayGroups = {};

  periodPayments
    .filter((p) => !p.isRefund)
    .forEach((p) => {
      const dayKey = p.createdAt.toISOString().slice(0, 10);
      if (!dayGroups[dayKey]) dayGroups[dayKey] = { date: dayKey, in: 0, out: 0, count: 0 };
      dayGroups[dayKey].in = round2(dayGroups[dayKey].in + p.amount);
    });

  transactions.forEach((tx) => {
    const dayKey = tx.createdAt.toISOString().slice(0, 10);
    if (!dayGroups[dayKey]) dayGroups[dayKey] = { date: dayKey, in: 0, out: 0, count: 0 };
    if (tx.type === "CASH_IN") dayGroups[dayKey].in = round2(dayGroups[dayKey].in + tx.amount);
    if (tx.type === "CASH_OUT") dayGroups[dayKey].out = round2(dayGroups[dayKey].out + tx.amount);
    dayGroups[dayKey].count += 1;
  });

  const sortedDays = Object.keys(dayGroups).sort();
  let prevClose = openingBalance;
  const dailyLedger = sortedDays.map((d) => {
    const g = dayGroups[d];
    const dayOpen = prevClose;
    const dayClose = round2(dayOpen + g.in - g.out);
    prevClose = dayClose;
    return {
      date: d,
      openingBalance: dayOpen,
      cashIn: g.in,
      cashOut: g.out,
      closingBalance: dayClose,
      count: g.count,
    };
  });

  const User = require("../models/User");
  const systemUsers = await User.find({ role: { $in: ["OWNER", "MANAGER", "CASHIER"] }, isActive: true }).select("name role email");
  const cashiers = systemUsers.map((u) => ({ id: u._id.toString(), name: u.name, role: u.role }));

  // Multi-cashier automatic attribution & settlement map
  const cashierSettlementMap = {};

  systemUsers.forEach((u) => {
    cashierSettlementMap[u._id.toString()] = {
      id: u._id.toString(),
      name: u.name,
      role: u.role,
      counter: "Counter 1",
      ordersBilled: 0,
      cashBilled: 0,
      pettyIn: 0,
      pettyOut: 0,
      expectedHandover: 0,
    };
  });

  periodPayments
    .filter((p) => !p.isRefund)
    .forEach((p) => {
      const u = p.receivedBy;
      const uId = u?._id ? u._id.toString() : (u ? u.toString() : "unknown");
      if (!cashierSettlementMap[uId]) {
        cashierSettlementMap[uId] = {
          id: uId,
          name: u?.name || "Staff",
          role: u?.role || "STAFF",
          counter: "Counter 1",
          ordersBilled: 0,
          cashBilled: 0,
          pettyIn: 0,
          pettyOut: 0,
          expectedHandover: 0,
        };
      }
      cashierSettlementMap[uId].ordersBilled += 1;
      cashierSettlementMap[uId].cashBilled = round2(cashierSettlementMap[uId].cashBilled + p.amount);
    });

  transactions.forEach((tx) => {
    const u = tx.paidBy;
    const uId = u?._id ? u._id.toString() : (u ? u.toString() : "unknown");
    if (!cashierSettlementMap[uId]) {
      cashierSettlementMap[uId] = {
        id: uId,
        name: u?.name || "Staff",
        role: u?.role || "STAFF",
        counter: tx.counterId || "Counter 1",
        ordersBilled: 0,
        cashBilled: 0,
        pettyIn: 0,
        pettyOut: 0,
        expectedHandover: 0,
      };
    }
    if (tx.counterId) cashierSettlementMap[uId].counter = tx.counterId;
    if (tx.type === "CASH_IN") cashierSettlementMap[uId].pettyIn = round2(cashierSettlementMap[uId].pettyIn + tx.amount);
    if (tx.type === "CASH_OUT") cashierSettlementMap[uId].pettyOut = round2(cashierSettlementMap[uId].pettyOut + tx.amount);
  });

  Object.values(cashierSettlementMap).forEach((c) => {
    c.expectedHandover = round2(c.cashBilled + c.pettyIn - c.pettyOut);
  });

  const cashierSettlements = Object.values(cashierSettlementMap).filter(
    (c) => c.ordersBilled > 0 || c.pettyIn > 0 || c.pettyOut > 0 || c.role === "CASHIER"
  );

  res.json({
    success: true,
    message: "OK",
    data: {
      openingBalance, // Starting balance before period
      todayCashSales: totalCashSales,
      totalCashIn: totalPettyIn,
      totalCashOut: totalPettyOut,
      netBalance: closingBalance, // Ending drawer cash after period
      totalTransactions: transactions.length,
      byCategory,
      cashiers,
      cashierSettlements,
      dailyLedger: dailyLedger.reverse(),
      transactions: transactions.reverse(),
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
