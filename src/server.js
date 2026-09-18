const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const initSocket = require("./sockets/socketHandler");

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });
  initSocket(io);
  app.set("io", io);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`[server] Port ${env.PORT} is already in use. Stop the existing process or set PORT to a free port.`);
      process.exit(1);
    }

    console.error("[server] Failed to start server:", error.message);
    process.exit(1);
  });

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`[server] Yummy Yards API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

start();
