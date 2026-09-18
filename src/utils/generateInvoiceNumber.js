const Invoice = require("../models/Invoice");

async function generateInvoiceNumber() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  const prefix = `INV-${datePart}-`;

  const latestInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  }).sort({ invoiceNumber: -1 });

  let seq = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  let candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  while (await Invoice.exists({ invoiceNumber: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  }

  return candidate;
}

module.exports = generateInvoiceNumber;
