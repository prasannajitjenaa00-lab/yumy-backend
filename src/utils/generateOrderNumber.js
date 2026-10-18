const Order = require("../models/Order");

async function generateOrderNumber() {
  const prefix = "ORD";

  // Find all existing orders matching ORD + digits (e.g. ORD00001, ORD00002)
  const existingOrders = await Order.find(
    { orderNumber: { $regex: `^${prefix}\\d+$` } },
    { orderNumber: 1 }
  ).lean();

  let maxSeq = 0;
  for (const o of existingOrders) {
    if (o.orderNumber) {
      const numStr = o.orderNumber.slice(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let seq = maxSeq + 1;
  let candidate = `${prefix}${String(seq).padStart(5, "0")}`;

  while (await Order.exists({ orderNumber: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(5, "0")}`;
  }

  return candidate;
}

module.exports = generateOrderNumber;
