// Generic CRUD controller factory for straightforward resources.
const { recordAudit } = require("../middleware/auditMiddleware");

function makeCrudController(Model, moduleName, { searchFields = [], populate = [] } = {}) {
  return {
    async list(req, res) {
      const { search, page = 1, limit = 50, ...filters } = req.query;
      const query = { ...filters };
      if (search && searchFields.length) {
        query.$or = searchFields.map((f) => ({ [f]: { $regex: search, $options: "i" } }));
      }
      let cursor = Model.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));
      populate.forEach((p) => { cursor = cursor.populate(p); });
      const [data, total] = await Promise.all([cursor, Model.countDocuments(query)]);
      res.json({ success: true, message: "OK", data, meta: { total, page: Number(page), limit: Number(limit) } });
    },

    async getOne(req, res) {
      let cursor = Model.findById(req.params.id);
      populate.forEach((p) => { cursor = cursor.populate(p); });
      const doc = await cursor;
      if (!doc) return res.status(404).json({ success: false, message: `${moduleName} not found` });
      res.json({ success: true, message: "OK", data: doc });
    },

    async create(req, res) {
      const doc = await Model.create(req.body);
      await recordAudit({ user: req.user, action: "CREATE", module: moduleName, recordId: doc._id, newValue: req.body, ip: req.ip });
      res.status(201).json({ success: true, message: `${moduleName} created successfully`, data: doc });
    },

    async update(req, res) {
      const oldDoc = await Model.findById(req.params.id);
      if (!oldDoc) return res.status(404).json({ success: false, message: `${moduleName} not found` });
      const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      await recordAudit({ user: req.user, action: "UPDATE", module: moduleName, recordId: doc._id, oldValue: oldDoc, newValue: req.body, ip: req.ip });
      res.json({ success: true, message: `${moduleName} updated successfully`, data: doc });
    },

    async remove(req, res) {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ success: false, message: `${moduleName} not found` });
      await recordAudit({ user: req.user, action: "DELETE", module: moduleName, recordId: doc._id, oldValue: doc, ip: req.ip });
      res.json({ success: true, message: `${moduleName} deleted successfully` });
    },
  };
}

module.exports = makeCrudController;
