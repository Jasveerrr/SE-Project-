import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { registerSocketServer } from "./sockets/socketManager.js";

const server = http.createServer(app);

registerSocketServer(server);

server.listen(env.PORT, env.HOST, () => {
  console.log(`SwiftShare backend listening on ${env.HOST}:${env.PORT}`);
});
