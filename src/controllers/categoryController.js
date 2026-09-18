const Category = require("../models/Category");
const makeCrudController = require("../utils/crudFactory");
module.exports = makeCrudController(Category, "CATEGORIES", { searchFields: ["name"] });
