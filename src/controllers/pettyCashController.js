const PettyCash = require("../models/PettyCash");
const CashierShift = require("../models/CashierShift");
const { recordAudit } = require("../middleware/auditMiddleware");
const { round2 } = require("../utils/calculations");
const { startOfDay, endOfDay } = require("../utils/dateUtils");

async function getCurrentBalance() {
  const transactions = await PettyCash.find().select("type amount");
  const totalIn = transactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);
  return round2(totalIn - totalOut);
}

// 1. Record Cash In (Top up float / add cash to drawer)
async function recordCashIn(req, res) {
  try {
    const { amount, reason, counterId, receiptRef, category } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount greater than 0 is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason for Cash In is required" });
    }

    const currentShift = await CashierShift.findOne({ cashier: req.user._id, status: "OPEN" });
    const prevBalance = await getCurrentBalance();
    const balanceAfter = round2(prevBalance + numAmount);

    const doc = await PettyCash.create({
      type: "CASH_IN",
      amount: round2(numAmount),
      category: category || "FLOAT_TOPUP",
      reason: reason.trim(),
      paidTo: req.user.name || "Self",
      paidBy: req.user._id,
      receiptRef: receiptRef ? receiptRef.trim() : "",
      counterId: counterId || "Counter 1",
      shift: currentShift ? currentShift._id : null,
      balanceAfter,
    });

    await recordAudit({
      user: req.user,
      action: "CREATE",
      module: "PETTY_CASH",
      recordId: doc._id,
      newValue: { type: "CASH_IN", amount: numAmount, reason },
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Cash In recorded successfully", data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Record Cash Out (Expense / Payout from drawer)
async function recordCashOut(req, res) {
  try {
    const { amount, category, reason, paidTo, counterId, receiptRef } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount greater than 0 is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason / description is required" });
    }

    const currentShift = await CashierShift.findOne({ cashier: req.user._id, status: "OPEN" });
    const prevBalance = await getCurrentBalance();
    const balanceAfter = round2(prevBalance - numAmount);

    const doc = await PettyCash.create({
      type: "CASH_OUT",
      amount: round2(numAmount),
      category: category || "OTHER",
      reason: reason.trim(),
      paidTo: paidTo ? paidTo.trim() : "",
      paidBy: req.user._id,
      receiptRef: receiptRef ? receiptRef.trim() : "",
      counterId: counterId || "Counter 1",
      shift: currentShift ? currentShift._id : null,
      balanceAfter,
    });

    await recordAudit({
      user: req.user,
      action: "CREATE",
      module: "PETTY_CASH",
      recordId: doc._id,
      newValue: { type: "CASH_OUT", amount: numAmount, category, reason },
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: "Cash Out recorded successfully", data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 3. List Transactions
async function list(req, res) {
  try {
    const { from, to, type, category, counterId, limit = 100 } = req.query;
    const filter = {};

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = startOfDay(new Date(from));
      if (to) filter.createdAt.$lte = endOfDay(new Date(to));
    }
    if (type && type !== "ALL") {
      filter.type = type;
    }
    if (category && category !== "ALL") {
      filter.category = category;
    }
    if (counterId && counterId !== "ALL") {
      filter.counterId = counterId;
    }

    const transactions = await PettyCash.find(filter)
      .populate("paidBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, message: "OK", data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Summary & Drawer Status with Carry-Forward Rollover
async function getSummary(req, res) {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const allTransactions = await PettyCash.find().sort({ createdAt: 1 });
    const pastTransactions = allTransactions.filter((t) => t.createdAt < todayStart);
    const todayTransactions = allTransactions.filter(
      (t) => t.createdAt >= todayStart && t.createdAt <= todayEnd
    );

    // Opening Balance for Today = Yesterday's Closing Balance (Total Net Cash before today)
    const pastIn = pastTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
    const pastOut = pastTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);
    const openingBalance = round2(pastIn - pastOut);

    const todayIn = round2(todayTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const todayOut = round2(todayTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));
    const currentBalance = round2(openingBalance + todayIn - todayOut);

    const totalIn = round2(allTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const totalOut = round2(allTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));

    // Category breakdown for cash out
    const categoryBreakdown = {};
    allTransactions
      .filter((t) => t.type === "CASH_OUT")
      .forEach((t) => {
        categoryBreakdown[t.category] = round2((categoryBreakdown[t.category] || 0) + t.amount);
      });

    // Build Daily Carry-Forward Ledger: Yesterday Close = Tomorrow Open
    const dayGroups = {};
    allTransactions.forEach((tx) => {
      const dayKey = tx.createdAt.toISOString().slice(0, 10);
      if (!dayGroups[dayKey]) {
        dayGroups[dayKey] = { date: dayKey, in: 0, out: 0, count: 0 };
      }
      if (tx.type === "CASH_IN") dayGroups[dayKey].in = round2(dayGroups[dayKey].in + tx.amount);
      if (tx.type === "CASH_OUT") dayGroups[dayKey].out = round2(dayGroups[dayKey].out + tx.amount);
      dayGroups[dayKey].count += 1;
    });

    // Ensure today is always present in dayGroups even if no transactions yet
    const todayKey = new Date().toISOString().slice(0, 10);
    if (!dayGroups[todayKey]) {
      dayGroups[todayKey] = { date: todayKey, in: 0, out: 0, count: 0 };
    }

    const sortedDays = Object.keys(dayGroups).sort();
    let prevClose = 0;
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

    res.json({
      success: true,
      message: "OK",
      data: {
        openingBalance, // Today's opening = yesterday's close
        currentBalance,
        todayIn,
        todayOut,
        todayCount: todayTransactions.length,
        totalIn,
        totalOut,
        categoryBreakdown,
        dailyLedger: dailyLedger.reverse().slice(0, 15), // Newest first
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  recordCashIn,
  recordCashOut,
  list,
  getSummary,
};

