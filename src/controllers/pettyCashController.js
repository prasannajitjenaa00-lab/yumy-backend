const PettyCash = require("../models/PettyCash");
const CashierShift = require("../models/CashierShift");
const Payment = require("../models/Payment");
const { recordAudit } = require("../middleware/auditMiddleware");
const { round2 } = require("../utils/calculations");
const { startOfDay, endOfDay } = require("../utils/dateUtils");

async function getCurrentBalance() {
  const transactions = await PettyCash.find().select("type amount");
  const totalPettyIn = transactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
  const totalPettyOut = transactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);

  const payments = await Payment.find().select("amount method isRefund");
  const cashSales = payments.filter((p) => p.method === "CASH" && !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const cashRefunds = payments.filter((p) => p.method === "CASH" && p.isRefund).reduce((s, p) => s + p.amount, 0);

  return round2(cashSales + totalPettyIn - cashRefunds - totalPettyOut);
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
    const { from, to, date, type, category, counterId, cashier, limit = 200 } = req.query;
    const filter = {};

    if (date) {
      filter.createdAt = {
        $gte: startOfDay(new Date(date)),
        $lte: endOfDay(new Date(date)),
      };
    } else if (from || to) {
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
    if (cashier && cashier !== "ALL") {
      filter.paidBy = cashier;
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

// 4. Summary & Drawer Status with Carry-Forward Rollover (Includes POS Cash Sales)
async function getSummary(req, res) {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : (req.query.from ? new Date(req.query.from) : new Date());
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const allTransactions = await PettyCash.find().populate("paidBy", "name email role").sort({ createdAt: 1 });
    const allPayments = await Payment.find().sort({ createdAt: 1 });

    // Past records (strictly before target date 00:00:00)
    const pastTransactions = allTransactions.filter((t) => t.createdAt < dayStart);
    const pastPayments = allPayments.filter((p) => p.createdAt < dayStart);

    const pastPettyIn = pastTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0);
    const pastPettyOut = pastTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0);
    const pastCashSales = pastPayments.filter((p) => p.method === "CASH" && !p.isRefund).reduce((s, p) => s + p.amount, 0);
    const pastCashRefunds = pastPayments.filter((p) => p.method === "CASH" && p.isRefund).reduce((s, p) => s + p.amount, 0);

    // Opening Balance for target date = Yesterday's Closing Balance
    const openingBalance = round2(pastCashSales + pastPettyIn - pastCashRefunds - pastPettyOut);

    // Selected date records
    const todayTransactions = allTransactions.filter(
      (t) => t.createdAt >= dayStart && t.createdAt <= dayEnd
    );
    const todayPayments = allPayments.filter(
      (p) => p.createdAt >= dayStart && p.createdAt <= dayEnd
    );

    const todayCashSales = round2(todayPayments.filter((p) => p.method === "CASH" && !p.isRefund).reduce((s, p) => s + p.amount, 0));
    const todayPettyIn = round2(todayTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const todayPettyOut = round2(todayTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));

    // Cash In combines order cash collections + float deposits
    const totalCashIn = round2(todayPettyIn + todayCashSales);
    const totalCashOut = todayPettyOut;

    // Current / Closing Balance for selected date
    const currentBalance = round2(openingBalance + totalCashIn - totalCashOut);
    const closingBalance = currentBalance;

    const totalMovement = round2(totalCashIn + totalCashOut);
    const cashInPct = totalMovement > 0 ? Math.round((totalCashIn / totalMovement) * 100) : 0;
    const cashOutPct = totalMovement > 0 ? (100 - cashInPct) : 0;

    const totalPettyIn = round2(allTransactions.filter((t) => t.type === "CASH_IN").reduce((s, t) => s + t.amount, 0));
    const totalPettyOut = round2(allTransactions.filter((t) => t.type === "CASH_OUT").reduce((s, t) => s + t.amount, 0));

    // Category breakdown for petty cash out
    const categoryBreakdown = {};
    allTransactions
      .filter((t) => t.type === "CASH_OUT")
      .forEach((t) => {
        categoryBreakdown[t.category] = round2((categoryBreakdown[t.category] || 0) + t.amount);
      });

    // Extract all distinct cashiers from transactions
    const cashiersMap = new Map();
    allTransactions.forEach((t) => {
      if (t.paidBy && t.paidBy._id) {
        cashiersMap.set(t.paidBy._id.toString(), {
          id: t.paidBy._id,
          name: t.paidBy.name,
          role: t.paidBy.role,
        });
      }
    });
    const cashiers = Array.from(cashiersMap.values());

    // Build Daily Carry-Forward Ledger (Combining Cash Sales + Petty In - Petty Out)
    const dayGroups = {};

    allPayments
      .filter((p) => p.method === "CASH" && !p.isRefund)
      .forEach((p) => {
        const dayKey = p.createdAt.toISOString().slice(0, 10);
        if (!dayGroups[dayKey]) dayGroups[dayKey] = { date: dayKey, in: 0, out: 0, count: 0 };
        dayGroups[dayKey].in = round2(dayGroups[dayKey].in + p.amount);
      });

    allTransactions.forEach((tx) => {
      const dayKey = tx.createdAt.toISOString().slice(0, 10);
      if (!dayGroups[dayKey]) dayGroups[dayKey] = { date: dayKey, in: 0, out: 0, count: 0 };
      if (tx.type === "CASH_IN") dayGroups[dayKey].in = round2(dayGroups[dayKey].in + tx.amount);
      if (tx.type === "CASH_OUT") dayGroups[dayKey].out = round2(dayGroups[dayKey].out + tx.amount);
      dayGroups[dayKey].count += 1;
    });

    // Ensure selected date is in ledger
    const targetKey = targetDate.toISOString().slice(0, 10);
    if (!dayGroups[targetKey]) {
      dayGroups[targetKey] = { date: targetKey, in: 0, out: 0, count: 0 };
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
        openingBalance, // Starting balance before selected date
        cashIn: totalCashIn, // Total Cash In (Petty Float + Cash Sales)
        cashOut: totalCashOut, // Total Cash Out (Petty Expenses)
        closingBalance, // Closing balance for selected date
        totalMovement,
        cashInPct,
        cashOutPct,
        todayCashSales,
        todayIn: todayPettyIn,
        todayOut: todayPettyOut,
        currentBalance,
        todayCount: todayTransactions.length,
        totalIn: totalPettyIn,
        totalOut: totalPettyOut,
        categoryBreakdown,
        cashiers,
        dailyLedger: dailyLedger.reverse().slice(0, 30),
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

