import { Server } from "socket.io";

export function registerSocketServer(server) {
  return new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });
}
