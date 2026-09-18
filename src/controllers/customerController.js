const Customer = require("../models/Customer");
const makeCrudController = require("../utils/crudFactory");
module.exports = makeCrudController(Customer, "CUSTOMERS", { searchFields: ["name", "phone"] });
