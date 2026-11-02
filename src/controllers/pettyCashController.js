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

// 4. Summary & Drawer Status
async function getSummary(req, res) {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const allTransactions = await PettyCash.find();
    const todayTransactions = allTransactions.filter(
      (t) => t.createdAt >= todayStart && t.createdAt <= todayEnd
    );

    const totalIn = round2(allTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const totalOut = round2(allTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));
    const currentBalance = round2(totalIn - totalOut);

    const todayIn = round2(todayTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const todayOut = round2(todayTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));

    // Category breakdown for cash out
    const categoryBreakdown = {};
    allTransactions
      .filter((t) => t.type === "CASH_OUT")
      .forEach((t) => {
        categoryBreakdown[t.category] = round2((categoryBreakdown[t.category] || 0) + t.amount);
      });

    res.json({
      success: true,
      message: "OK",
      data: {
        currentBalance,
        totalIn,
        totalOut,
        todayIn,
        todayOut,
        todayCount: todayTransactions.length,
        categoryBreakdown,
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

