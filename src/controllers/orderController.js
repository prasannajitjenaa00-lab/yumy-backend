const Order = require("../models/Order");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const MenuItem = require("../models/MenuItem");
const InventoryItem = require("../models/InventoryItem");
const StockTransaction = require("../models/StockTransaction");
const generateOrderNumber = require("../utils/generateOrderNumber");
const { calculateOrderTotals } = require("../utils/calculations");
const { recordAudit } = require("../middleware/auditMiddleware");

async function deductInventoryForOrder(order, userId) {
  const menuIds = order.items.map((i) => i.menuItem);
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds } });
  const menuMap = new Map(menuDocs.map((m) => [String(m._id), m]));

  for (const orderItem of order.items) {
    const menuItem = menuMap.get(String(orderItem.menuItem));
    if (!menuItem || !menuItem.recipe || !menuItem.recipe.length) continue;
    for (const ingredient of menuItem.recipe) {
      const qtyToDeduct = ingredient.quantity * orderItem.quantity;
      const invItem = await InventoryItem.findById(ingredient.inventoryItem);
      if (!invItem) continue;
      invItem.currentStock = Math.max(0, invItem.currentStock - qtyToDeduct);
      await invItem.save();
      await StockTransaction.create({
        inventoryItem: invItem._id,
        type: "SALE",
        quantity: -qtyToDeduct,
        order: order._id,
        reference: order.orderNumber,
        createdBy: userId,
      });
    }
  }
}

const ORDER_TRANSITIONS = {
  DRAFT: ["OPEN", "CONFIRMED", "CANCELLED"],
  OPEN: ["CONFIRMED", "PREPARING", "READY", "SERVED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "READY", "SERVED", "CANCELLED"],
  PREPARING: ["READY", "SERVED", "CANCELLED"],
  READY: ["SERVED", "COMPLETED", "CANCELLED"],
  SERVED: ["COMPLETED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

function getIO(req) {
  return req.app.get("io");
}

async function recalculate(order, discount) {
  const items = order.items.map((i) => ({ price: i.price, quantity: i.quantity, taxPercent: i.taxPercent }));
  const totals = calculateOrderTotals({ items, discount: discount ?? order.discount });
  Object.assign(order, totals);
}

async function list(req, res) {
  const { status, orderType, table, date, page = 1, limit = 50 } = req.query;
  const query = {};
  if (status) query.orderStatus = status;
  if (orderType) query.orderType = orderType;
  if (table) query.table = table;
  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: start, $lte: end };
  }
  const [data, total] = await Promise.all([
    Order.find(query).populate("table customer createdBy", "number name phone")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Order.countDocuments(query),
  ]);
  res.json({ success: true, message: "OK", data, meta: { total, page: Number(page), limit: Number(limit) } });
}

async function getOne(req, res) {
  const order = await Order.findById(req.params.id)
    .populate("table customer createdBy items.menuItem billRequestedBy billProcessedBy statusHistory.changedBy", "name role number phone");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  res.json({ success: true, message: "OK", data: order });
}

async function create(req, res) {
  const { orderType = "DINE_IN", table, customer, items = [], notes, discount = 0, taxRate, paymentMethod } = req.body;

  let resolvedTable = null;
  if (table) {
    resolvedTable = await Table.findById(table);
  }

  const menuIds = items.map((i) => i.menuItem);
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds } });
  const menuMap = new Map(menuDocs.map((m) => [String(m._id), m]));

  const taxOverridePercent = taxRate !== undefined && taxRate !== null && !isNaN(Number(taxRate)) ? Number(taxRate) : null;

  const orderItems = items.map((i) => {
    const menuItem = menuMap.get(String(i.menuItem));
    if (!menuItem) throw Object.assign(new Error("Invalid menu item in order"), { statusCode: 400 });
    if (!menuItem.isAvailable) throw Object.assign(new Error(`${menuItem.name} is currently unavailable`), { statusCode: 400 });
    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      taxPercent: taxOverridePercent !== null ? taxOverridePercent : menuItem.taxPercent,
      quantity: i.quantity,
      notes: i.notes,
    };
  });

  const totals = calculateOrderTotals({ items: orderItems, discount, taxOverridePercent });
  const orderNumber = await generateOrderNumber();

  let resolvedCustomer = null;
  if (customer && (customer.phone || customer.name)) {
    const phone = customer.phone ? String(customer.phone).trim() : "";
    const name = customer.name ? String(customer.name).trim() : "Guest";
    try {
      if (phone) {
        resolvedCustomer = await Customer.findOneAndUpdate(
          { phone },
          { $set: { name: name || "Guest" }, $setOnInsert: { phone } },
          { upsert: true, new: true }
        );
      } else if (name) {
        resolvedCustomer = await Customer.create({ name });
      }
    } catch (custErr) {
      console.warn("Customer find/create fallback:", custErr.message);
    }
  }

  const isPaidAtCounter = Boolean(paymentMethod);

  const order = await Order.create({
    orderNumber,
    orderType,
    table: resolvedTable ? resolvedTable._id : null,
    customer: resolvedCustomer ? resolvedCustomer._id : null,
    items: orderItems,
    notes,
    discount,
    ...totals,
    orderStatus: "DRAFT",
    paymentStatus: isPaidAtCounter ? "PAID" : "UNPAID",
    paymentMethod: isPaidAtCounter ? paymentMethod : null,
    billStatus: isPaidAtCounter ? "PAID" : "NOT_REQUESTED",
    createdBy: req.user._id,
  });

  if (isPaidAtCounter) {
    try {
      const Payment = require("../models/Payment");
      await Payment.create({
        order: order._id,
        amount: order.grandTotal,
        method: paymentMethod,
        receivedBy: req.user._id,
      });
    } catch (payErr) {
      console.warn("Auto-payment recording error:", payErr.message);
    }
  }

  if (resolvedCustomer) {
    try {
      await Customer.findByIdAndUpdate(resolvedCustomer._id, {
        $inc: { totalOrders: 1, totalSpending: order.grandTotal },
        $set: { lastOrderAt: new Date() },
      });
    } catch (custUpdateErr) {
      console.warn("Failed to update customer stats:", custUpdateErr.message);
    }
  }

  if (resolvedTable) {
    resolvedTable.status = "OCCUPIED";
    resolvedTable.currentOrder = order._id;
    await resolvedTable.save();
  }

  await recordAudit({ user: req.user, action: "CREATE", module: "ORDERS", recordId: order._id, newValue: { orderNumber }, ip: req.ip });
  getIO(req)?.emit("order:new", { orderId: order._id, orderNumber: order.orderNumber });

  res.status(201).json({ success: true, message: "Order created successfully", data: order });
}

async function updateItems(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.orderStatus)) {
    return res.status(400).json({ success: false, message: "Cannot edit a completed, cancelled, or refunded order. Use the authorized correction workflow." });
  }

  const { items, discount, notes } = req.body;
  if (items) {
    const menuIds = items.map((i) => i.menuItem);
    const menuDocs = await MenuItem.find({ _id: { $in: menuIds } });
    const menuMap = new Map(menuDocs.map((m) => [String(m._id), m]));
    order.items = items.map((i) => {
      const menuItem = menuMap.get(String(i.menuItem));
      if (!menuItem) throw Object.assign(new Error("Invalid menu item in order"), { statusCode: 400 });
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        taxPercent: menuItem.taxPercent,
        quantity: i.quantity,
        notes: i.notes,
      };
    });
  }
  if (notes !== undefined) order.notes = notes;
  await recalculate(order, discount);
  await order.save();

  res.json({ success: true, message: "Order updated", data: order });
}

async function updateStatus(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  const { status } = req.body;

  const allowed = ORDER_TRANSITIONS[order.orderStatus] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Cannot move order from ${order.orderStatus} to ${status}` });
  }
  if (status === "COMPLETED" && order.paymentStatus !== "PAID") {
    return res.status(400).json({ success: false, message: "Order must be fully paid before it can be completed" });
  }

  order.statusHistory.push({ previousStatus: order.orderStatus, newStatus: status, changedBy: req.user._id });
  order.orderStatus = status;

  if (status === "SERVED") {
    order.items.forEach((item) => { item.kotStatus = "SERVED"; });
    try {
      const KOT = require("../models/KOT");
      await KOT.updateMany({ order: order._id }, { status: "SERVED" });
      getIO(req)?.emit("kot:status", { orderId: order._id, status: "SERVED" });
    } catch (err) {
      console.error("KOT update error on serve:", err);
    }
    if (order.paymentStatus === "PAID") {
      order.orderStatus = "COMPLETED";
      order.statusHistory.push({ previousStatus: "SERVED", newStatus: "COMPLETED", changedBy: req.user._id });
    }
  }

  await order.save();

  if (order.orderStatus === "COMPLETED" && order.table) {
    await Table.findByIdAndUpdate(order.table, { status: "AVAILABLE", currentOrder: null });
  }
  if (order.orderStatus === "COMPLETED") {
    await deductInventoryForOrder(order, req.user._id);
  }
  if (status === "CANCELLED" && order.table) {
    await Table.findByIdAndUpdate(order.table, { status: "AVAILABLE", currentOrder: null });
  }

  getIO(req)?.emit("order:status", { orderId: order._id, orderNumber: order.orderNumber, status: order.orderStatus });
  await recordAudit({ user: req.user, action: "UPDATE_STATUS", module: "ORDERS", recordId: order._id, newValue: { status: order.orderStatus }, ip: req.ip });

  res.json({ success: true, message: `Order status updated to ${order.orderStatus}`, data: order });
}

async function cancel(req, res) {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: "Cancellation reason is required" });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.orderStatus)) {
    return res.status(400).json({ success: false, message: "This order cannot be cancelled" });
  }
  order.statusHistory.push({ previousStatus: order.orderStatus, newStatus: "CANCELLED", changedBy: req.user._id });
  order.orderStatus = "CANCELLED";
  order.cancelReason = reason;
  await order.save();
  if (order.table) await Table.findByIdAndUpdate(order.table, { status: "AVAILABLE", currentOrder: null });

  await recordAudit({ user: req.user, action: "CANCEL", module: "ORDERS", recordId: order._id, newValue: { reason }, ip: req.ip });
  getIO(req)?.emit("order:status", { orderId: order._id, orderNumber: order.orderNumber, status: "CANCELLED" });

  res.json({ success: true, message: "Order cancelled", data: order });
}

async function requestBill(req, res) {
  const order = await Order.findById(req.params.id).populate("table customer createdBy");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.orderStatus)) {
    return res.status(400).json({ success: false, message: `Cannot request bill for a ${order.orderStatus.toLowerCase()} order.` });
  }

  if (order.paymentStatus === "PAID") {
    return res.status(400).json({ success: false, message: "This order has already been paid." });
  }

  if (order.billStatus === "REQUESTED") {
    return res.status(400).json({ success: false, message: "Bill has already been requested for this order." });
  }

  order.billStatus = "REQUESTED";
  order.billRequestedAt = new Date();
  order.billRequestedBy = req.user._id;
  await order.save();

  if (order.table) {
    const tableId = order.table._id || order.table;
    await Table.findByIdAndUpdate(tableId, { status: "BILL_PENDING" });
    getIO(req)?.emit("table:update", { tableId, status: "BILL_PENDING" });
  }

  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    tableNumber: order.table?.number || "N/A",
    grandTotal: order.grandTotal,
    itemCount: order.items?.length || 0,
    requestedBy: req.user.name || "Staff",
    billRequestedAt: order.billRequestedAt,
  };

  getIO(req)?.emit("bill:request", payload);
  await recordAudit({ user: req.user, action: "BILL_REQUESTED", module: "ORDERS", recordId: order._id, newValue: payload, ip: req.ip });

  const targetLabel = order.table?.number ? `Table ${order.table.number}` : `Order #${order.orderNumber}`;
  res.json({ success: true, message: `Bill request created for ${targetLabel}`, data: order });
}

async function processBill(req, res) {
  const order = await Order.findById(req.params.id).populate("table customer createdBy");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  order.billStatus = "PROCESSING";
  order.billProcessedAt = new Date();
  order.billProcessedBy = req.user._id;
  await order.save();

  getIO(req)?.emit("bill:processing", { orderId: order._id, orderNumber: order.orderNumber });
  res.json({ success: true, message: "Bill is being processed", data: order });
}

async function listBillRequests(req, res) {
  const query = {
    $or: [
      { billStatus: { $in: ["REQUESTED", "PROCESSING"] } },
      { orderStatus: "SERVED", paymentStatus: "UNPAID" },
    ],
  };
  const billRequests = await Order.find(query)
    .populate("table customer createdBy billRequestedBy")
    .sort({ billRequestedAt: -1, createdAt: -1 });

  res.json({ success: true, message: "OK", data: billRequests });
}

async function clearTable(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.table) {
    await Table.findByIdAndUpdate(order.table, { status: "AVAILABLE", currentOrder: null });
    getIO(req)?.emit("table:update", { tableId: order.table, status: "AVAILABLE" });
  }

  res.json({ success: true, message: "Table cleared and set to AVAILABLE" });
}

module.exports = {
  list,
  getOne,
  create,
  updateItems,
  updateStatus,
  cancel,
  requestBill,
  processBill,
  listBillRequests,
  clearTable,
  deductInventoryForOrder,
  ORDER_TRANSITIONS,
};
