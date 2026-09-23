import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { registerSocketEvents } from "./socketEvents.js";

export let io = null;

function buildCorsOrigins() {
  const configuredOrigins = String(env.CLIENT_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length > 0 ? configuredOrigins : ["http://localhost:5173"];
}

function getSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();

  const authorization = socket.handshake?.headers?.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

export function registerSocketServer(server) {
  if (io) {
    return io;
  }

  if (!server || typeof server.on !== "function") {
    throw new TypeError("registerSocketServer requires a valid HTTP server instance.");
  }

  const corsOrigins = buildCorsOrigins();

  try {
    io = new Server(server, {
      cors: {
        origin: corsOrigins,
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    io.use((socket, next) => {
      try {
        const token = getSocketToken(socket);
        if (!token) return next(new Error("Authentication required."));

        const claims = jwt.verify(token, env.JWT_SECRET);
        if (!claims || typeof claims !== "object" || typeof claims.sub !== "string") {
          return next(new Error("Invalid authentication token."));
        }

        socket.data.userId = claims.sub;
        socket.data.email = typeof claims.email === "string" ? claims.email : undefined;
        return next();
      } catch (_error) {
        return next(new Error("Invalid authentication token."));
      }
    });

    io.on("connection", (socket) => {
      console.log(`[socket] client connected`, { socketId: socket.id });

      // Socket event registration stays in the dedicated event module.
      if (typeof registerSocketEvents !== "function") {
        throw new TypeError("registerSocketEvents must export a function.");
      }

      registerSocketEvents(socket, io);

      socket.on("disconnect", (reason) => {
        console.log(`[socket] client disconnected`, {
          socketId: socket.id,
          reason,
        });
      });
    });

    io.engine.on("connection_error", (error) => {
      console.error(`[socket] socket connection error`, {
        error: error instanceof Error ? error.message : String(error),
        code: error.code,
        message: error.message,
      });
    });

    io.on("error", (error) => {
      console.error(`[socket] socket server error`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    console.log(`[socket] socket server initialized`, {
      origins: corsOrigins,
    });

    return io;
  } catch (error) {
    console.error(`[socket] failed to initialize socket server`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
