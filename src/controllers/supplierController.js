const Supplier = require("../models/Supplier");
const makeCrudController = require("../utils/crudFactory");
module.exports = makeCrudController(Supplier, "SUPPLIERS", { searchFields: ["name", "phone", "email"] });
