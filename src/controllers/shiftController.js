const CashierShift = require("../models/CashierShift");
const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const { round2 } = require("../utils/calculations");

async function openShift(req, res) {
  const existing = await CashierShift.findOne({ cashier: req.user._id, status: "OPEN" });
  if (existing) return res.status(400).json({ success: false, message: "You already have an open shift" });
  const shift = await CashierShift.create({ cashier: req.user._id, openingCash: req.body.openingCash });
  res.status(201).json({ success: true, message: "Shift opened", data: shift });
}

async function closeShift(req, res) {
  const shift = await CashierShift.findById(req.params.id);
  if (!shift || shift.status !== "OPEN") return res.status(404).json({ success: false, message: "Open shift not found" });

  const payments = await Payment.find({ receivedBy: shift.cashier, createdAt: { $gte: shift.openingTime }, isRefund: false });
  const refunds = await Payment.find({ receivedBy: shift.cashier, createdAt: { $gte: shift.openingTime }, isRefund: true });
  const expenses = await Expense.find({ addedBy: shift.cashier, createdAt: { $gte: shift.openingTime } });

  shift.cashSales = round2(payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0));
  shift.upiSales = round2(payments.filter((p) => p.method === "UPI").reduce((s, p) => s + p.amount, 0));
  shift.cardSales = round2(payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0));
  shift.otherSales = round2(payments.filter((p) => p.method === "OTHER").reduce((s, p) => s + p.amount, 0));
  shift.refunds = round2(refunds.reduce((s, p) => s + p.amount, 0));
  shift.expenses = round2(expenses.reduce((s, e) => s + e.amount, 0));
  shift.expectedCash = round2(shift.openingCash + shift.cashSales - shift.expenses);
  shift.actualCash = req.body.actualCash;
  shift.difference = round2(shift.actualCash - shift.expectedCash);
  shift.closingTime = new Date();
  shift.status = "CLOSED";
  await shift.save();

  res.json({ success: true, message: "Shift closed", data: shift });
}

async function list(req, res) {
  const shifts = await CashierShift.find().populate("cashier", "name").sort({ createdAt: -1 });
  res.json({ success: true, message: "OK", data: shifts });
}

async function current(req, res) {
  const shift = await CashierShift.findOne({ cashier: req.user._id, status: "OPEN" });
  res.json({ success: true, message: "OK", data: shift });
}

module.exports = { openShift, closeShift, list, current };
