import { AppError } from "../utils/AppError.js";
import { DeviceService } from "./DeviceService.js";
import { PairingService } from "./PairingService.js";
import { TransferService } from "./TransferService.js";

const DEVICE_ROOM_PREFIX = "device:";
const EVENT_NAMES = {
  deviceDiscover: "device:discover",
  pairingRequest: "pairing:request",
  pairingAccept: "pairing:accept",
  pairingReject: "pairing:reject",
  transferStart: "transfer:start",
  transferProgress: "transfer:progress",
  transferComplete: "transfer:complete",
  transferCancel: "transfer:cancel",
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const now = () => new Date().toISOString();

function assertSocket(socket) {
  if (!socket || typeof socket.id !== "string") {
    throw new AppError("A valid socket connection is required.", 400);
  }
}

function assertIo(io) {
  if (!io || typeof io.to !== "function") {
    throw new AppError("A valid Socket.IO server instance is required.", 400);
  }
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError("payload must be an object.", 400);
  }
}

function requireSocketData(socket) {
  assertSocket(socket);
  if (!socket.data) socket.data = {};
  return socket.data;
}

function resolveSocketDeviceId(socket, payload = {}) {
  return (
    toTrimmedString(
      payload.senderDeviceId ??
        payload.sourceDeviceId ??
        payload.fromDeviceId ??
        payload.deviceId ??
        socket.data?.deviceId
    ) || ""
  );
}

function resolveReceiverDeviceId(payload = {}) {
  return (
    toTrimmedString(
      payload.receiverDeviceId ??
        payload.targetDeviceId ??
        payload.toDeviceId ??
        payload.peerDeviceId
    ) || ""
  );
}

function resolvePairingId(payload = {}) {
  return toTrimmedString(payload.pairingId ?? payload.id) || "";
}

function resolveTransferId(payload = {}) {
  return toTrimmedString(payload.transferId ?? payload.id ?? payload.transfer?.id) || "";
}

function deviceRoom(deviceId) {
  const value = toTrimmedString(deviceId);
  if (!value) {
    throw new AppError("deviceId is required.", 400);
  }

  return `${DEVICE_ROOM_PREFIX}${value}`;
}

function rememberDeviceId(socket, deviceId) {
  const data = requireSocketData(socket);
  const value = toTrimmedString(deviceId);
  if (value) data.deviceId = value;
}

function cleanupSocketData(socket) {
  const data = socket.data;
  if (!data) {
    return 0;
  }

  const rooms = Array.from(data.rooms instanceof Set ? data.rooms : []);
  for (const roomName of rooms) {
    if (typeof socket.leave === "function") {
      socket.leave(roomName);
    }
  }

  if (data.rooms instanceof Set) {
    data.rooms.clear();
  }

  delete data.deviceId;
  delete data.lastPingAt;
  delete data.lastPingPayload;
  delete data.connectedAt;
  delete data.lastActivityAt;

  data.disconnectedAt = now();
  return rooms.length;
}

function emitToDevice(io, deviceId, eventName, payload) {
  assertIo(io);
  io.to(deviceRoom(deviceId)).emit(eventName, payload);
}

function emitToParticipants(io, participants, eventName, payload) {
  const uniqueParticipants = new Set();
  for (const participant of participants) {
    const deviceId = toTrimmedString(participant);
    if (deviceId) uniqueParticipants.add(deviceId);
  }

  for (const deviceId of uniqueParticipants) {
    emitToDevice(io, deviceId, eventName, payload);
  }
}

function emitBroadcast(socket, io, eventName, payload) {
  assertIo(io);
  if (socket?.broadcast && typeof socket.broadcast.emit === "function") {
    socket.broadcast.emit(eventName, payload);
    return;
  }

  io.emit(eventName, payload);
}

function buildSocketPayload(socket, payload = {}) {
  const data = requireSocketData(socket);
  return {
    ...payload,
    deviceId: resolveSocketDeviceId(socket, payload) || undefined,
    senderDeviceId: resolveSocketDeviceId(socket, payload) || undefined,
    sourceDeviceId: resolveSocketDeviceId(socket, payload) || undefined,
    fromDeviceId: resolveSocketDeviceId(socket, payload) || undefined,
    userId: data.userId ?? payload.userId,
  };
}

function buildDiscoveryPayload(socket, payload = {}) {
  const socketDeviceId = resolveSocketDeviceId(socket, payload);
  return {
    ...payload,
    deviceId: socketDeviceId || toTrimmedString(payload.deviceId) || undefined,
  };
}

function withServiceResultMetadata(result, key) {
  return result && typeof result === "object" && key in result ? result[key] : null;
}

async function runPairingService(serviceMethod, payload) {
  return serviceMethod({ payload });
}

async function runTransferService(serviceMethod, socket, payload) {
  return serviceMethod({ socket, payload });
}

async function sendPairingNotification({
  socket,
  io,
  payload,
  serviceMethod,
  eventName,
  recipientResolver,
}) {
  assertSocket(socket);
  assertIo(io);
  assertPayload(payload);

  const result = await runPairingService(serviceMethod, buildSocketPayload(socket, payload));
  const pairing = withServiceResultMetadata(result, "pairing");
  const recipientDeviceId = recipientResolver(pairing, payload, socket);

  if (recipientDeviceId) {
    emitToDevice(io, recipientDeviceId, eventName, result);
  }

  return result;
}

async function sendTransferNotification({ socket, io, payload, serviceMethod, eventName }) {
  assertSocket(socket);
  assertIo(io);
  assertPayload(payload);

  const enrichedPayload = buildSocketPayload(socket, payload);
  const result = await runTransferService(serviceMethod, socket, enrichedPayload);
  const transfer = withServiceResultMetadata(result, "transfer");

  if (transfer) {
    emitToParticipants(io, [transfer.sourceDeviceId, transfer.targetDeviceId], eventName, result);
  }

  return result;
}

export const SocketService = {
  async handlePing({ socket, payload = {} } = {}) {
    assertSocket(socket);
    assertPayload(payload);

    const data = requireSocketData(socket);
    data.lastPingAt = now();
    data.lastPingPayload = payload;
    data.lastActivityAt = data.lastPingAt;

    return {
      socketId: socket.id,
      serverTime: data.lastPingAt,
      echoedAt: payload.timestamp ?? null,
    };
  },

  async handleDisconnect({ socket, reason } = {}) {
    assertSocket(socket);
    const data = requireSocketData(socket);
    const disconnectedDeviceId = data.deviceId ?? null;

    let removedDevices = 0;
    if (disconnectedDeviceId) {
      try {
        const response = await DeviceService.removeDisconnectedDevice({
          socket,
          payload: { deviceId: disconnectedDeviceId },
        });
        removedDevices = response?.removed ? 1 : 0;
      } catch (error) {
        if (!(error instanceof AppError)) {
          throw error;
        }
      }
    }

    const roomsCleared = cleanupSocketData(socket);
    data.lastDisconnectReason = toTrimmedString(reason) || "disconnect";

    return {
      socketId: socket.id,
      deviceId: disconnectedDeviceId,
      removedDevices,
      roomsCleared,
      reason: data.lastDisconnectReason,
      disconnectedAt: data.disconnectedAt,
    };
  },

  async requestPairing({ socket, io, payload = {} } = {}) {
    return sendPairingNotification({
      socket,
      io,
      payload,
      serviceMethod: PairingService.requestPairing,
      eventName: EVENT_NAMES.pairingRequest,
      recipientResolver: (pairing, requestPayload, currentSocket) =>
        pairing?.receiverDeviceId ||
        resolveReceiverDeviceId(requestPayload) ||
        currentSocket.data?.deviceId,
    });
  },

  async acceptPairing({ socket, io, payload = {} } = {}) {
    return sendPairingNotification({
      socket,
      io,
      payload,
      serviceMethod: PairingService.acceptPairing,
      eventName: EVENT_NAMES.pairingAccept,
      recipientResolver: (pairing) => pairing?.senderDeviceId || "",
    });
  },

  async rejectPairing({ socket, io, payload = {} } = {}) {
    return sendPairingNotification({
      socket,
      io,
      payload,
      serviceMethod: PairingService.rejectPairing,
      eventName: EVENT_NAMES.pairingReject,
      recipientResolver: (pairing) => pairing?.senderDeviceId || "",
    });
  },

  async broadcastDeviceDiscovery({ socket, io, payload = {} } = {}) {
    assertSocket(socket);
    assertPayload(payload);

    const discoveryPayload = buildDiscoveryPayload(socket, payload);
    const result = await DeviceService.discoverDevices({ socket, payload: discoveryPayload });
    const deviceId = result?.device?.deviceId || discoveryPayload.deviceId || "";

    if (deviceId) {
      rememberDeviceId(socket, deviceId);
    }

    emitBroadcast(socket, io, EVENT_NAMES.deviceDiscover, result);
    return result;
  },

  async notifyTransferStarted({ socket, io, payload = {} } = {}) {
    return sendTransferNotification({
      socket,
      io,
      payload,
      serviceMethod: TransferService.startTransfer,
      eventName: EVENT_NAMES.transferStart,
    });
  },

  async notifyTransferProgress({ socket, io, payload = {} } = {}) {
    return sendTransferNotification({
      socket,
      io,
      payload,
      serviceMethod: TransferService.updateTransferProgress,
      eventName: EVENT_NAMES.transferProgress,
    });
  },

  async notifyTransferCompleted({ socket, io, payload = {} } = {}) {
    return sendTransferNotification({
      socket,
      io,
      payload,
      serviceMethod: TransferService.completeTransfer,
      eventName: EVENT_NAMES.transferComplete,
    });
  },

  async notifyTransferCancelled({ socket, io, payload = {} } = {}) {
    return sendTransferNotification({
      socket,
      io,
      payload,
      serviceMethod: TransferService.cancelTransfer,
      eventName: EVENT_NAMES.transferCancel,
    });
  },
};
