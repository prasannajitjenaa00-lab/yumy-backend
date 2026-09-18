const Order = require("../models/Order");

async function generateOrderNumber() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  const prefix = `ORD-${datePart}-`;

  const latestOrder = await Order.findOne({
    orderNumber: { $regex: `^${prefix}` },
  }).sort({ orderNumber: -1 });

  let seq = 1;
  if (latestOrder && latestOrder.orderNumber) {
    const parts = latestOrder.orderNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  let candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  while (await Order.exists({ orderNumber: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  }

  return candidate;
}

module.exports = generateOrderNumber;
