import { AppError } from "../utils/AppError.js";

const pairings = new Map();
const ACTIVE_STATUSES = new Set(["pending"]);
const TERMINAL_STATUSES = new Set(["accepted", "rejected", "cancelled"]);
const VALID_STATUSES = new Set(["pending", "accepted", "rejected", "cancelled"]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const now = () => new Date().toISOString();

function clonePairing(pairing) {
  return pairing ? { ...pairing } : null;
}

function buildResponse(message, pairing, extra = {}) {
  return { message, pairing: clonePairing(pairing), ...extra };
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError("payload must be an object.", 400);
  }
}

function resolvePairingId(payload) {
  const pairingId = toTrimmedString(payload.pairingId ?? payload.id);
  if (!pairingId) {
    throw new AppError("pairingId is required.", 400);
  }

  return pairingId;
}

function resolveDeviceId(payload, keys, fieldName) {
  for (const key of keys) {
    const value = toTrimmedString(payload[key]);
    if (value) {
      return value;
    }
  }

  throw new AppError(`${fieldName} is required.`, 400);
}

function resolveSenderDeviceId(payload) {
  return resolveDeviceId(
    payload,
    ["senderDeviceId", "sourceDeviceId", "fromDeviceId", "deviceId"],
    "senderDeviceId"
  );
}

function resolveReceiverDeviceId(payload) {
  return resolveDeviceId(
    payload,
    ["receiverDeviceId", "targetDeviceId", "toDeviceId", "peerDeviceId"],
    "receiverDeviceId"
  );
}

function getPairingOrThrow(pairingId) {
  const pairing = pairings.get(pairingId);
  if (!pairing) {
    throw new AppError(`Pairing not found: ${pairingId}.`, 404);
  }

  return pairing;
}

function isActivePairing(pairing) {
  return ACTIVE_STATUSES.has(pairing.status);
}

function findDuplicateActivePairing(senderDeviceId, receiverDeviceId) {
  for (const pairing of pairings.values()) {
    const sameDirection =
      pairing.senderDeviceId === senderDeviceId && pairing.receiverDeviceId === receiverDeviceId;
    const reverseDirection =
      pairing.senderDeviceId === receiverDeviceId && pairing.receiverDeviceId === senderDeviceId;

    if ((sameDirection || reverseDirection) && isActivePairing(pairing)) {
      return pairing;
    }
  }

  return null;
}

function assertTerminalTransition(pairing, action) {
  if (TERMINAL_STATUSES.has(pairing.status)) {
    throw new AppError(`Cannot ${action} a pairing that is already ${pairing.status}.`, 400);
  }

  if (pairing.status !== "pending") {
    throw new AppError(`Cannot ${action} a pairing in ${pairing.status} state.`, 400);
  }
}

function createPairingRecord(payload) {
  const pairingId = resolvePairingId(payload);
  const senderDeviceId = resolveSenderDeviceId(payload);
  const receiverDeviceId = resolveReceiverDeviceId(payload);

  if (senderDeviceId === receiverDeviceId) {
    throw new AppError("senderDeviceId and receiverDeviceId must be different.", 400);
  }

  if (pairings.has(pairingId)) {
    throw new AppError(`Pairing already exists: ${pairingId}.`, 409);
  }

  const duplicatePairing = findDuplicateActivePairing(senderDeviceId, receiverDeviceId);
  if (duplicatePairing) {
    throw new AppError("An active pairing request already exists for these devices.", 409);
  }

  const timestamp = now();
  const pairing = {
    pairingId,
    senderDeviceId,
    receiverDeviceId,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  pairings.set(pairingId, pairing);
  return pairing;
}

function updatePairingStatus(pairing, status) {
  if (!VALID_STATUSES.has(status)) {
    throw new AppError(`Invalid pairing status: ${status}.`, 400);
  }

  pairing.status = status;
  pairing.updatedAt = now();
  return pairing;
}

export const PairingService = {
  async requestPairing({ payload } = {}) {
    assertPayload(payload);
    const pairing = createPairingRecord(payload);
    return buildResponse("Pairing request created.", pairing, { status: pairing.status });
  },

  async acceptPairing({ payload } = {}) {
    assertPayload(payload);
    const pairing = getPairingOrThrow(resolvePairingId(payload));
    assertTerminalTransition(pairing, "accept");
    updatePairingStatus(pairing, "accepted");
    return buildResponse("Pairing request accepted.", pairing, { status: pairing.status });
  },

  async rejectPairing({ payload } = {}) {
    assertPayload(payload);
    const pairing = getPairingOrThrow(resolvePairingId(payload));
    assertTerminalTransition(pairing, "reject");
    updatePairingStatus(pairing, "rejected");
    return buildResponse("Pairing request rejected.", pairing, { status: pairing.status });
  },

  async cancelPairing({ payload } = {}) {
    assertPayload(payload);
    const pairing = getPairingOrThrow(resolvePairingId(payload));
    assertTerminalTransition(pairing, "cancel");
    updatePairingStatus(pairing, "cancelled");
    return buildResponse("Pairing request cancelled.", pairing, { status: pairing.status });
  },

  async getPairingStatus({ payload } = {}) {
    assertPayload(payload);
    const pairing = getPairingOrThrow(resolvePairingId(payload));
    return buildResponse("Pairing status retrieved.", pairing, { status: pairing.status });
  },
};
