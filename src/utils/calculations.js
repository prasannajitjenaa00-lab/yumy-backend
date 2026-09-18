// Decimal-safe money math: work in paise (integer smallest unit) internally.
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}
function toRupees(paise) {
  return Math.round(paise) / 100;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// items: [{ price, quantity, taxPercent }]
function calculateOrderTotals({ items, discount = 0, taxOverridePercent = null }) {
  let subtotalPaise = 0;
  let taxPaise = 0;

  items.forEach((item) => {
    const linePaise = toPaise(item.price) * item.quantity;
    subtotalPaise += linePaise;
    const taxPercent = taxOverridePercent !== null ? taxOverridePercent : (item.taxPercent || 0);
    taxPaise += Math.round((linePaise * taxPercent) / 100);
  });

  const discountPaise = toPaise(discount || 0);
  const taxableSubtotalPaise = Math.max(subtotalPaise - discountPaise, 0);
  const preRoundPaise = taxableSubtotalPaise + taxPaise;
  const roundedPaise = Math.round(preRoundPaise / 100) * 100;
  const roundOffPaise = roundedPaise - preRoundPaise;

  return {
    subtotal: toRupees(subtotalPaise),
    discount: toRupees(discountPaise),
    taxAmount: toRupees(taxPaise),
    roundOff: toRupees(roundOffPaise),
    grandTotal: toRupees(roundedPaise),
  };
}

module.exports = { toPaise, toRupees, round2, calculateOrderTotals };
