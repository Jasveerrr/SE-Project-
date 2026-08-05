const devices = new Map();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const now = () => new Date().toISOString();

function cloneDevice(device) {
  return { ...device };
}
function buildResponse(message, device, extra = {}) {
  return { message, device: cloneDevice(device), ...extra };
}
function assertSocket(socket) {
  if (!socket || typeof socket.id !== "string")
    throw new Error("A valid socket connection is required.");
}

function getDeviceId(payload) {
  const deviceId = toTrimmedString(payload.deviceId ?? payload.id);
  if (!deviceId) throw new Error("deviceId is required.");
  return deviceId;
}

function getDeviceOrThrow(deviceId) {
  const device = devices.get(deviceId);
  if (!device) throw new Error(`Device not found: ${deviceId}.`);
  return device;
}

function findDeviceBySocketId(socketId) {
  for (const device of devices.values()) if (device.socketId === socketId) return device;
  return null;
}

function assertRequiredDeviceFields(payload, fields) {
  for (const field of fields)
    if (!toTrimmedString(payload[field])) throw new Error(`${field} is required.`);
}

function normalizeDeviceFields(payload) {
  return {
    deviceName: toTrimmedString(payload.deviceName ?? payload.name),
    ipAddress: toTrimmedString(payload.ipAddress ?? payload.ip ?? payload.address),
    platform: toTrimmedString(payload.platform ?? payload.os),
  };
}

function writeDeviceRecord(deviceId, socketId, payload, status) {
  const existing = devices.get(deviceId) ?? {};
  const fields = normalizeDeviceFields(payload);
  const timestamp = now();
  const record = {
    deviceId,
    socketId,
    deviceName: fields.deviceName || existing.deviceName || null,
    ipAddress: fields.ipAddress || existing.ipAddress || null,
    platform: fields.platform || existing.platform || null,
    status: status ?? existing.status ?? "connected",
    connectedAt: existing.connectedAt || timestamp,
    lastSeen: timestamp,
    updatedAt: timestamp,
  };

  if (!record.deviceName || !record.ipAddress || !record.platform) {
    throw new Error("deviceName, ipAddress, and platform are required.");
  }

  for (const [key, device] of devices.entries()) {
    if (key !== deviceId && device.socketId === socketId) devices.delete(key);
  }

  devices.set(deviceId, record);
  return record;
}

const listDevices = () =>
  Array.from(devices.values())
    .map(cloneDevice)
    .sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));

function resolveTargetDevice(socket, payload) {
  const deviceId = toTrimmedString(payload.deviceId ?? payload.id);
  if (deviceId) return getDeviceOrThrow(deviceId);
  if (socket?.id) {
    const device = findDeviceBySocketId(socket.id);
    if (device) return device;
  }
  throw new Error("deviceId is required.");
}

export const DeviceService = {
  async discoverDevices({ socket, payload } = {}) {
    assertSocket(socket);
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    assertRequiredDeviceFields(payload, ["deviceId", "deviceName", "ipAddress", "platform"]);
    const device = writeDeviceRecord(getDeviceId(payload), socket.id, payload, "connected");
    return buildResponse("Device discovered.", device, {
      devices: listDevices(),
      count: devices.size,
    });
  },

  async refreshDevices({ socket, payload } = {}) {
    assertSocket(socket);
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const device = writeDeviceRecord(getDeviceId(payload), socket.id, payload, "connected");
    return buildResponse("Device refreshed.", device, {
      devices: listDevices(),
      count: devices.size,
    });
  },

  async getDevice({ payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const device = getDeviceOrThrow(getDeviceId(payload));
    return buildResponse("Device found.", device, { devices: listDevices(), count: devices.size });
  },

  async updateDevice({ socket, payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const deviceId = getDeviceId(payload);
    const device = getDeviceOrThrow(deviceId);

    if (socket?.id && device.socketId !== socket.id)
      throw new Error("This device belongs to another socket connection.");

    const fields = normalizeDeviceFields(payload);
    if (payload.deviceName !== undefined && !fields.deviceName)
      throw new Error("deviceName cannot be empty.");
    if (payload.ipAddress !== undefined && !fields.ipAddress)
      throw new Error("ipAddress cannot be empty.");
    if (payload.platform !== undefined && !fields.platform)
      throw new Error("platform cannot be empty.");

    device.deviceName = fields.deviceName || device.deviceName;
    device.ipAddress = fields.ipAddress || device.ipAddress;
    device.platform = fields.platform || device.platform;
    device.status = toTrimmedString(payload.status) || device.status || "connected";
    device.lastSeen = now();
    device.updatedAt = device.lastSeen;
    return buildResponse("Device updated.", device, {
      devices: listDevices(),
      count: devices.size,
    });
  },

  async removeDisconnectedDevice({ socket, payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const device = resolveTargetDevice(socket, payload);
    const timestamp = now();
    const removed = {
      ...device,
      status: "disconnected",
      disconnectedAt: timestamp,
      lastSeen: timestamp,
    };
    devices.delete(device.deviceId);
    return buildResponse("Device removed.", removed, {
      removed: true,
      devices: listDevices(),
      count: devices.size,
    });
  },
};
