import { PrismaClient } from "@prisma/client";
import { AppError } from "../utils/AppError.js";

let prismaClient = null;
let connectionPromise = null;
let shutdownHooksRegistered = false;
let isConnected = false;

function log(message, meta = {}) {
  console.log(`[database] ${message}`, meta);
}

function warn(message, meta = {}) {
  console.warn(`[database] ${message}`, meta);
}

function error(message, meta = {}) {
  console.error(`[database] ${message}`, meta);
}

function buildAppError(message, statusCode = 500, cause) {
  const appError = new AppError(message, statusCode);
  if (cause) appError.cause = cause;
  return appError;
}

function createClient() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
    log("Prisma client initialized.");
  }

  return prismaClient;
}

function registerShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = async (signal) => {
    try {
      warn(`Shutdown signal received: ${signal}. Disconnecting Prisma.`);
      await DatabaseService.disconnect();
      log("Graceful shutdown complete.");
      process.exit(0);
    } catch (shutdownError) {
      error("Graceful shutdown failed.", {
        message: shutdownError instanceof Error ? shutdownError.message : String(shutdownError),
      });
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

export const DatabaseService = {
  async connect() {
    if (isConnected && prismaClient) {
      return prismaClient;
    }

    if (connectionPromise) {
      return connectionPromise;
    }

    connectionPromise = (async () => {
      try {
        const client = createClient();
        await client.$connect();
        isConnected = true;
        registerShutdownHooks();
        log("Prisma connected.");
        return client;
      } catch (connectError) {
        isConnected = false;
        prismaClient = null;
        error("Prisma connection failed.", {
          message: connectError instanceof Error ? connectError.message : String(connectError),
        });
        throw buildAppError("Failed to connect to the database.", 500, connectError);
      } finally {
        connectionPromise = null;
      }
    })();

    return connectionPromise;
  },

  async disconnect() {
    if (!prismaClient) {
      isConnected = false;
      return true;
    }

    try {
      await prismaClient.$disconnect();
      isConnected = false;
      log("Prisma disconnected.");
      return true;
    } catch (disconnectError) {
      error("Prisma disconnection failed.", {
        message:
          disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
      });
      throw buildAppError("Failed to disconnect from the database.", 500, disconnectError);
    }
  },

  async healthCheck() {
    try {
      const client = await this.getClient();
      await client.$queryRaw`SELECT 1`;
      return {
        status: "healthy",
        connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (healthError) {
      error("Health check failed.", {
        message: healthError instanceof Error ? healthError.message : String(healthError),
      });
      throw buildAppError("Database health check failed.", 503, healthError);
    }
  },

  async getClient() {
    if (isConnected && prismaClient) {
      return prismaClient;
    }

    return this.connect();
  },

  get isConnected() {
    return isConnected;
  },
};
