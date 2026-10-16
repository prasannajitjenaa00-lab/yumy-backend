const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Setting = require("../models/Setting");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");

async function generate(req, res) {
  const { orderId } = req.body;
  const order = await Order.findById(orderId).populate("customer");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  let invoice = await Invoice.findOne({ order: order._id });
  if (invoice) {
    return res.json({ success: true, message: "Invoice already exists", data: invoice });
  }

  const invoiceNumber = await generateInvoiceNumber();
  invoice = await Invoice.create({
    invoiceNumber,
    order: order._id,
    customer: order.customer ? order.customer._id : null,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    taxAmount: order.taxAmount,
    roundOff: order.roundOff,
    grandTotal: order.grandTotal,
    paymentStatus: order.paymentStatus,
    cashier: req.user._id,
  });

  if (order.customer) {
    await Customer.findByIdAndUpdate(order.customer._id, {
      $inc: { totalOrders: 1, totalSpending: order.grandTotal, loyaltyPoints: Math.floor(order.grandTotal / 100) },
      lastOrderAt: new Date(),
    });
  }

  if (order.billStatus !== "PAID") {
    order.billStatus = "GENERATED";
    order.billProcessedAt = new Date();
    order.billProcessedBy = req.user._id;
    await order.save();
  }

  res.status(201).json({ success: true, message: "Invoice generated successfully", data: invoice });
}

async function getByOrder(req, res) {
  const invoice = await Invoice.findOne({ order: req.params.orderId }).populate("customer cashier", "name phone role");
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found for this order" });
  res.json({ success: true, message: "OK", data: invoice });
}

async function reprint(req, res) {
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { $inc: { reprintCount: 1 } }, { new: true });
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
  res.json({ success: true, message: "Invoice ready for reprint", data: invoice });
}

module.exports = { generate, getByOrder, reprint };
