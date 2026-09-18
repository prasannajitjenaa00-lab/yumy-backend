function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: err.publicMessage || "Something went wrong",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
}

module.exports = { notFound, errorHandler };
