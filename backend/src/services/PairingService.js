import { DatabaseService } from "./DatabaseService.js";
import { AppError } from "../utils/AppError.js";

const PAIRING_STATUSES = new Set(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"]);
const TERMINAL_STATUSES = new Set(["ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"]);
const pairingInclude = { senderDevice: true, receiverDevice: true };
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value) => (typeof value === "string" ? value.trim() : "");

function currentUserId(payload) {
  return text(payload.userId ?? payload.user?.id ?? payload.user?.userId);
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) throw new AppError("payload must be an object.", 400);
}

function deviceId(payload, keys, name) {
  for (const key of keys) {
    const value = text(payload[key]);
    if (value) return value;
  }
  throw new AppError(`${name} is required.`, 400);
}

function senderId(payload) {
  return deviceId(
    payload,
    ["senderDeviceId", "sourceDeviceId", "fromDeviceId", "deviceId"],
    "senderDeviceId"
  );
}

function receiverId(payload) {
  return deviceId(
    payload,
    ["receiverDeviceId", "targetDeviceId", "toDeviceId", "peerDeviceId"],
    "receiverDeviceId"
  );
}

function pairingId(payload) {
  const value = text(payload.pairingId ?? payload.id);
  if (!value) throw new AppError("pairingId is required.", 400);
  return value;
}

function serializeDevice(device) {
  return device?.deviceId ?? device?.id ?? null;
}

function serializePairing(pairing) {
  if (!pairing) return null;
  return {
    id: pairing.id,
    pairingId: pairing.pairingId,
    senderDeviceId: serializeDevice(pairing.senderDevice) ?? pairing.senderDeviceId,
    receiverDeviceId: serializeDevice(pairing.receiverDevice) ?? pairing.receiverDeviceId,
    status: pairing.status,
    createdAt: pairing.createdAt,
    updatedAt: pairing.updatedAt,
  };
}

function result(message, pairing) {
  return { message, pairing: serializePairing(pairing), status: pairing.status };
}

function assertPairingAccess(pairing, userId) {
  if (!userId) throw new AppError("Authentication required.", 401);
  const ownsPairing = [pairing.senderDevice?.userId, pairing.receiverDevice?.userId].includes(
    userId
  );
  if (!ownsPairing) throw new AppError("You are not authorized to access this pairing.", 403);
}

function assertPairingRole(pairing, userId, role) {
  assertPairingAccess(pairing, userId);
  const device = role === "receiver" ? pairing.receiverDevice : pairing.senderDevice;
  if (device?.userId !== userId) {
    throw new AppError(`Only the ${role} device owner can change this pairing.`, 403);
  }
}

function handleDatabaseError(error, message) {
  if (error instanceof AppError) throw error;
  if (error?.code === "P2002") throw new AppError("Pairing already exists.", 409);
  if (error?.code === "P2025") throw new AppError("Pairing not found.", 404);
  throw new AppError(message, 500);
}

async function findDevice(prisma, value) {
  return prisma.device.findFirst({ where: { OR: [{ id: value }, { deviceId: value }] } });
}

async function getPairing(prisma, value) {
  const pairing = await prisma.pairing.findFirst({
    where: { OR: [{ id: value }, { pairingId: value }] },
    include: pairingInclude,
  });
  if (!pairing) throw new AppError("Pairing not found.", 404);
  return pairing;
}

async function changeStatus(prisma, payload, status, role) {
  const pairing = await getPairing(prisma, pairingId(payload));
  assertPairingRole(pairing, currentUserId(payload), role);
  if (TERMINAL_STATUSES.has(pairing.status)) {
    throw new AppError(`Cannot change a pairing that is already ${pairing.status}.`, 400);
  }
  if (pairing.status !== "PENDING")
    throw new AppError(`Cannot change a pairing in ${pairing.status} state.`, 400);
  const updated = await prisma.pairing.update({
    where: { id: pairing.id },
    data: { status },
    include: pairingInclude,
  });
  return result(`Pairing request ${status.toLowerCase()}.`, updated);
}

export const PairingService = {
  async requestPairing(input = {}) {
    const payload = input?.payload ?? input;
    assertPayload(payload);
    const id = pairingId(payload);
    const senderDevice = senderId(payload);
    const receiverDevice = receiverId(payload);
    if (senderDevice === receiverDevice)
      throw new AppError("senderDeviceId and receiverDeviceId must be different.", 400);
    const prisma = await DatabaseService.getClient();
    try {
      const [sender, receiver] = await Promise.all([
        findDevice(prisma, senderDevice),
        findDevice(prisma, receiverDevice),
      ]);
      if (!sender) throw new AppError("Sender device not found.", 404);
      if (!receiver) throw new AppError("Receiver device not found.", 404);
      if (sender.id === receiver.id)
        throw new AppError("senderDeviceId and receiverDeviceId must be different.", 400);
      const userId = currentUserId(payload);
      if (userId && sender.userId !== userId) {
        throw new AppError("You are not authorized to send this pairing request.", 403);
      }
      const duplicate = await prisma.pairing.findFirst({
        where: {
          status: "PENDING",
          OR: [
            { senderDeviceId: sender.id, receiverDeviceId: receiver.id },
            { senderDeviceId: receiver.id, receiverDeviceId: sender.id },
          ],
        },
        include: pairingInclude,
      });
      if (duplicate)
        throw new AppError("An active pairing request already exists for these devices.", 409);
      const pairing = await prisma.pairing.create({
        data: { pairingId: id, senderDeviceId: sender.id, receiverDeviceId: receiver.id },
        include: pairingInclude,
      });
      return result("Pairing request created.", pairing);
    } catch (error) {
      handleDatabaseError(error, "Unable to create pairing request.");
    }
  },

  async acceptPairing(input = {}) {
    const payload = input?.payload ?? input;
    assertPayload(payload);
    try {
      return await changeStatus(await DatabaseService.getClient(), payload, "ACCEPTED", "receiver");
    } catch (error) {
      handleDatabaseError(error, "Unable to accept pairing request.");
    }
  },

  async rejectPairing(input = {}) {
    const payload = input?.payload ?? input;
    assertPayload(payload);
    try {
      return await changeStatus(await DatabaseService.getClient(), payload, "REJECTED", "receiver");
    } catch (error) {
      handleDatabaseError(error, "Unable to reject pairing request.");
    }
  },

  async cancelPairing(input = {}) {
    const payload = input?.payload ?? input;
    assertPayload(payload);
    try {
      return await changeStatus(await DatabaseService.getClient(), payload, "CANCELLED", "sender");
    } catch (error) {
      handleDatabaseError(error, "Unable to cancel pairing request.");
    }
  },

  async getPairingStatus(input = {}) {
    const payload = input?.payload ?? input;
    assertPayload(payload);
    try {
      const pairing = await getPairing(await DatabaseService.getClient(), pairingId(payload));
      assertPairingAccess(pairing, currentUserId(payload));
      return result("Pairing status retrieved.", pairing);
    } catch (error) {
      handleDatabaseError(error, "Unable to fetch pairing status.");
    }
  },
};

export { PAIRING_STATUSES };
