const jwt = require("jsonwebtoken");
const env = require("../config/env");

function initSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = decoded;
    } catch (err) {
      // Allow anonymous kitchen-display style connections; protected emits still require auth on REST side.
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    socket.on("join", (room) => {
      socket.join(room);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}

module.exports = initSocket;
