import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { registerSocketServer } from "./sockets/socketManager.js";

const server = http.createServer(app);

registerSocketServer(server);

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `[server] Port ${env.PORT} is already in use on ${env.HOST}. Another SwiftShare backend may still be running. Stop it with: lsof -i :${env.PORT} -t | xargs kill`
    );
    process.exitCode = 1;
    return;
  }

  console.error("[server] Failed to start backend server.", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

server.listen(env.PORT, env.HOST, () => {
  console.log(`SwiftShare backend listening on ${env.HOST}:${env.PORT}`);
});
