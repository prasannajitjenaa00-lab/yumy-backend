const Expense = require("../models/Expense");
const makeCrudController = require("../utils/crudFactory");
const { recordAudit } = require("../middleware/auditMiddleware");

const crud = makeCrudController(Expense, "EXPENSES", { populate: ["addedBy"] });

module.exports = {
  ...crud,
  async create(req, res) {
    if (!req.body.addedBy && req.user) {
      req.body.addedBy = req.user._id;
    }
    const doc = await Expense.create(req.body);
    await recordAudit({ user: req.user, action: "CREATE", module: "EXPENSES", recordId: doc._id, newValue: req.body, ip: req.ip });
    res.status(201).json({ success: true, message: "Expense created successfully", data: doc });
  },
};
