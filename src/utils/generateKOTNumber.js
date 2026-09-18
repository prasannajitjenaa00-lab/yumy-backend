const KOT = require("../models/KOT");

async function generateKOTNumber() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  const prefix = `KOT-${datePart}-`;

  const latestKot = await KOT.findOne({
    kotNumber: { $regex: `^${prefix}` },
  }).sort({ kotNumber: -1 });

  let seq = 1;
  if (latestKot && latestKot.kotNumber) {
    const parts = latestKot.kotNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  let candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  while (await KOT.exists({ kotNumber: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  }

  return candidate;
}

module.exports = generateKOTNumber;
