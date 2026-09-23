import { DatabaseService } from "./DatabaseService.js";
import { AppError } from "../utils/AppError.js";

const DEVICE_PLATFORMS = new Set([
  "WINDOWS",
  "MACOS",
  "LINUX",
  "ANDROID",
  "IOS",
  "IPADOS",
  "WEB",
  "UNKNOWN",
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toString = (value) => (typeof value === "string" ? value.trim() : "");
const deviceInclude = { user: { select: { id: true, email: true, displayName: true } } };

function assertPayload(payload) {
  if (!isPlainObject(payload)) throw new AppError("payload must be an object.", 400);
}

function getDeviceId(payload) {
  const deviceId = toString(payload.deviceId ?? payload.id);
  if (!deviceId) throw new AppError("deviceId is required.", 400);
  return deviceId;
}

function getUserId(payload, required = true) {
  const userId = toString(payload.userId ?? payload.user?.id ?? payload.user?.userId);
  if (required && !userId) throw new AppError("userId is required.", 401);
  return userId || undefined;
}

function getDeviceName(payload, required = true) {
  const deviceName = toString(payload.deviceName ?? payload.name);
  if (required && !deviceName) throw new AppError("deviceName is required.", 400);
  if (deviceName.length > 100) throw new AppError("deviceName cannot exceed 100 characters.", 400);
  return deviceName;
}

function getIpAddress(payload, required = true) {
  const ipAddress = toString(payload.ipAddress ?? payload.ip ?? payload.address);
  if (required && !ipAddress) throw new AppError("ipAddress is required.", 400);
  if (ipAddress.length > 255) throw new AppError("ipAddress is invalid.", 400);
  return ipAddress;
}

function getPlatform(payload, required = true) {
  const platform = toString(payload.platform ?? payload.os).toUpperCase();
  if (required && !platform) throw new AppError("platform is required.", 400);
  if (platform && !DEVICE_PLATFORMS.has(platform)) {
    throw new AppError(`Invalid device platform: ${platform}.`, 400);
  }
  return platform;
}

function serializeDevice(device) {
  if (!device) return null;
  return {
    id: device.id,
    deviceId: device.deviceId,
    userId: device.userId,
    deviceName: device.deviceName,
    ipAddress: device.ipAddress,
    platform: device.platform,
    status: device.status,
    socketId: device.socketId,
    connectedAt: device.connectedAt,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    user: device.user ?? undefined,
  };
}

function response(message, device, extra = {}) {
  return { message, device: serializeDevice(device), ...extra };
}

function handleDatabaseError(error, fallbackMessage) {
  if (error instanceof AppError) throw error;
  if (error?.code === "P2002") throw new AppError("Device or socket already exists.", 409);
  if (error?.code === "P2025") throw new AppError("Device not found.", 404);
  throw new AppError(fallbackMessage, 500);
}

function invocation(input = {}) {
  return input && Object.prototype.hasOwnProperty.call(input, "payload")
    ? { socket: input.socket, payload: input.payload }
    : { socket: undefined, payload: input };
}

async function findDevice(prisma, deviceId) {
  return prisma.device.findFirst({
    where: { OR: [{ id: deviceId }, { deviceId }] },
    include: deviceInclude,
  });
}

export const DeviceService = {
  async discoverDevices(input = {}) {
    const { socket, payload } = invocation(input);
    assertPayload(payload);
    const deviceId = getDeviceId(payload);
    const userId = getUserId(payload);
    const prisma = await DatabaseService.getClient();

    try {
      const existing = await findDevice(prisma, deviceId);
      if (existing && existing.userId !== userId)
        throw new AppError("Device belongs to another user.", 403);
      const device = existing
        ? await prisma.device.update({
            where: { id: existing.id },
            data: {
              deviceName: getDeviceName(payload),
              ipAddress: getIpAddress(payload),
              platform: getPlatform(payload),
              status: "connected",
              socketId: socket?.id ?? (toString(payload.socketId) || null),
              connectedAt: existing.connectedAt ?? new Date(),
              lastSeenAt: new Date(),
            },
            include: deviceInclude,
          })
        : await prisma.device.create({
            data: {
              deviceId,
              userId,
              deviceName: getDeviceName(payload),
              ipAddress: getIpAddress(payload),
              platform: getPlatform(payload),
              status: "connected",
              socketId: socket?.id ?? (toString(payload.socketId) || null),
              connectedAt: new Date(),
              lastSeenAt: new Date(),
            },
            include: deviceInclude,
          });
      return response("Device discovered.", device, {
        devices: await this.listDevices({ userId }),
        count: 1,
      });
    } catch (error) {
      handleDatabaseError(error, "Unable to discover device.");
    }
  },

  async refreshDevices(input = {}) {
    return this.discoverDevices(input);
  },

  async listDevices(input = {}) {
    const { payload } = invocation(input);
    const filters = isPlainObject(payload) ? payload : {};
    const prisma = await DatabaseService.getClient();
    try {
      const devices = await prisma.device.findMany({
        where: { ...(getUserId(filters, false) ? { userId: getUserId(filters, false) } : {}) },
        include: deviceInclude,
        orderBy: { lastSeenAt: "desc" },
      });
      return devices.map(serializeDevice);
    } catch (error) {
      handleDatabaseError(error, "Unable to fetch devices.");
    }
  },

  async getDevice(input = {}) {
    const { payload } = invocation(input);
    assertPayload(payload);
    const deviceId = getDeviceId(payload);
    const prisma = await DatabaseService.getClient();
    try {
      const device = await findDevice(prisma, deviceId);
      if (!device) throw new AppError("Device not found.", 404);
      const userId = getUserId(payload, false);
      if (userId && userId !== device.userId)
        throw new AppError("Device belongs to another user.", 403);
      return response("Device found.", device);
    } catch (error) {
      handleDatabaseError(error, "Unable to fetch device.");
    }
  },

  async updateDevice(input = {}) {
    const { socket, payload } = invocation(input);
    assertPayload(payload);
    const deviceId = getDeviceId(payload);
    const prisma = await DatabaseService.getClient();
    try {
      const existing = await findDevice(prisma, deviceId);
      if (!existing) throw new AppError("Device not found.", 404);
      const userId = getUserId(payload, false);
      if (userId && userId !== existing.userId)
        throw new AppError("Device belongs to another user.", 403);
      if (socket?.id && existing.socketId && socket.id !== existing.socketId) {
        throw new AppError("This device belongs to another socket connection.", 403);
      }
      const data = {};
      if (payload.deviceName !== undefined || payload.name !== undefined)
        data.deviceName = getDeviceName(payload);
      if (
        payload.ipAddress !== undefined ||
        payload.ip !== undefined ||
        payload.address !== undefined
      )
        data.ipAddress = getIpAddress(payload);
      if (payload.platform !== undefined || payload.os !== undefined)
        data.platform = getPlatform(payload);
      if (payload.status !== undefined) {
        const status = toString(payload.status).toLowerCase();
        if (!["connected", "disconnected"].includes(status))
          throw new AppError("Invalid device status.", 400);
        data.status = status;
      }
      if (payload.socketId !== undefined) data.socketId = toString(payload.socketId) || null;
      data.lastSeenAt = new Date();
      const device = await prisma.device.update({
        where: { id: existing.id },
        data,
        include: deviceInclude,
      });
      return response("Device updated.", device);
    } catch (error) {
      handleDatabaseError(error, "Unable to update device.");
    }
  },

  async removeDisconnectedDevice(input = {}) {
    const { socket, payload } = invocation(input);
    assertPayload(payload);
    const deviceId = getDeviceId(payload);
    const prisma = await DatabaseService.getClient();
    try {
      const existing = await findDevice(prisma, deviceId);
      if (!existing) throw new AppError("Device not found.", 404);
      if (socket?.id && existing.socketId && socket.id !== existing.socketId) {
        throw new AppError("This device belongs to another socket connection.", 403);
      }
      const device = await prisma.device.update({
        where: { id: existing.id },
        data: { status: "disconnected", socketId: null, lastSeenAt: new Date() },
        include: deviceInclude,
      });
      return response("Device disconnected.", device, { removed: true });
    } catch (error) {
      handleDatabaseError(error, "Unable to disconnect device.");
    }
  },
};
