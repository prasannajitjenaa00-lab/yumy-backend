const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { recordAudit } = require("../middleware/auditMiddleware");

async function list(req, res) {
  const { search, page = 1, limit = 50 } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [rawCustomers, total] = await Promise.all([
    Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    Customer.countDocuments(query),
  ]);

  const customerIds = rawCustomers.map((c) => c._id);

  // Aggregate real orders and real spending directly from Order collection
  const orderStats = await Order.aggregate([
    {
      $match: {
        customer: { $in: customerIds },
        orderStatus: { $ne: "CANCELLED" },
      },
    },
    {
      $group: {
        _id: "$customer",
        totalOrders: { $sum: 1 },
        totalSpending: { $sum: "$grandTotal" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);

  const statsMap = new Map(orderStats.map((s) => [String(s._id), s]));

  const data = rawCustomers.map((c) => {
    const s = statsMap.get(String(c._id)) || {};
    const totalOrders = s.totalOrders ?? c.totalOrders ?? 0;
    const totalSpending = Math.round((s.totalSpending ?? c.totalSpending ?? 0) * 100) / 100;
    const lastOrderAt = s.lastOrderAt || c.lastOrderAt || c.createdAt;
    const loyaltyPoints = Math.floor(totalSpending / 50);

    return {
      ...c,
      totalOrders,
      totalSpending,
      lastOrderAt,
      loyaltyPoints,
    };
  });

  res.json({
    success: true,
    message: "OK",
    data,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
    },
  });
}

async function getOne(req, res) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }

  // Fetch real order history for this customer
  const orders = await Order.find({ customer: customer._id, orderStatus: { $ne: "CANCELLED" } })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("orderNumber grandTotal orderStatus paymentStatus paymentMethod orderType createdAt items")
    .lean();

  const totalOrders = orders.length;
  const totalSpending = Math.round(orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0) * 100) / 100;
  const lastOrderAt = orders.length ? orders[0].createdAt : customer.lastOrderAt || customer.createdAt;
  const loyaltyPoints = Math.floor(totalSpending / 50);

  res.json({
    success: true,
    message: "OK",
    data: {
      ...customer,
      totalOrders,
      totalSpending,
      lastOrderAt,
      loyaltyPoints,
      orders,
    },
  });
}

async function create(req, res) {
  const doc = await Customer.create(req.body);
  await recordAudit({
    user: req.user,
    action: "CREATE",
    module: "CUSTOMERS",
    recordId: doc._id,
    newValue: req.body,
    ip: req.ip,
  });
  res.status(201).json({ success: true, message: "Customer created successfully", data: doc });
}

async function update(req, res) {
  const oldDoc = await Customer.findById(req.params.id);
  if (!oldDoc) return res.status(404).json({ success: false, message: "Customer not found" });
  const doc = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  await recordAudit({
    user: req.user,
    action: "UPDATE",
    module: "CUSTOMERS",
    recordId: doc._id,
    oldValue: oldDoc,
    newValue: req.body,
    ip: req.ip,
  });
  res.json({ success: true, message: "Customer updated successfully", data: doc });
}

async function remove(req, res) {
  const doc = await Customer.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: "Customer not found" });
  await recordAudit({
    user: req.user,
    action: "DELETE",
    module: "CUSTOMERS",
    recordId: doc._id,
    oldValue: doc,
    ip: req.ip,
  });
  res.json({ success: true, message: "Customer deleted successfully" });
}

module.exports = { list, getOne, create, update, remove };
