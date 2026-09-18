const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ success: true, message: "Yummy Yards API is running" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/menu", require("./routes/menuRoutes"));
app.use("/api/tables", require("./routes/tableRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/kots", require("./routes/kotRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/purchases", require("./routes/purchaseRoutes"));
app.use("/api/suppliers", require("./routes/supplierRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/shifts", require("./routes/shiftRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
