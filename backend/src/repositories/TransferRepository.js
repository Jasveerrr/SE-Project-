// TODO: migrate this repository to Prisma/PostgreSQL.
const transfers = new Map();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const now = () => new Date().toISOString();

function cloneTransfer(transfer) {
  return transfer ? { ...transfer } : null;
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) throw new Error("payload must be an object.");
}

function resolveTransferId(payload) {
  const transferId = toTrimmedString(payload.transferId ?? payload.id ?? payload.transfer?.id);
  if (!transferId) throw new Error("transferId is required.");
  return transferId;
}

function ensureTransferExists(transferId) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error(`Transfer not found: ${transferId}.`);
  return transfer;
}

function normalizeRecord(payload, existing = null) {
  const transferId = existing?.transferId ?? resolveTransferId(payload);
  const timestamp = now();

  return {
    transferId,
    fileName:
      toTrimmedString(payload.fileName ?? payload.name ?? existing?.fileName) ||
      existing?.fileName ||
      null,
    fileSize:
      typeof payload.fileSize === "number" && Number.isFinite(payload.fileSize)
        ? payload.fileSize
        : (existing?.fileSize ?? null),
    bytesTransferred:
      typeof payload.bytesTransferred === "number" && Number.isFinite(payload.bytesTransferred)
        ? payload.bytesTransferred
        : (existing?.bytesTransferred ?? 0),
    progress:
      typeof payload.progress === "number" && Number.isFinite(payload.progress)
        ? payload.progress
        : (existing?.progress ?? 0),
    status: toTrimmedString(payload.status) || existing?.status || "active",
    socketId: toTrimmedString(payload.socketId) || existing?.socketId || null,
    sourceDeviceId:
      toTrimmedString(payload.sourceDeviceId ?? payload.deviceId ?? payload.fromDeviceId) ||
      existing?.sourceDeviceId ||
      null,
    targetDeviceId:
      toTrimmedString(payload.targetDeviceId ?? payload.toDeviceId) ||
      existing?.targetDeviceId ||
      null,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function listTransfers() {
  return Array.from(transfers.values())
    .map(cloneTransfer)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export const TransferRepository = {
  async create(payload = {}) {
    assertPayload(payload);
    const transferId = resolveTransferId(payload);

    if (transfers.has(transferId)) {
      throw new Error(`Transfer already exists: ${transferId}.`);
    }

    const transfer = normalizeRecord({ ...payload, transferId });
    transfers.set(transferId, transfer);
    return cloneTransfer(transfer);
  },

  async findById(transferId) {
    const resolvedTransferId = toTrimmedString(transferId);
    if (!resolvedTransferId) throw new Error("transferId is required.");
    return cloneTransfer(transfers.get(resolvedTransferId));
  },

  async findAll() {
    return listTransfers();
  },

  async update(transferId, payload = {}) {
    const resolvedTransferId = toTrimmedString(transferId);
    if (!resolvedTransferId) throw new Error("transferId is required.");
    assertPayload(payload);

    const existing = ensureTransferExists(resolvedTransferId);
    const nextTransfer = normalizeRecord({ ...payload, transferId: resolvedTransferId }, existing);
    transfers.set(resolvedTransferId, nextTransfer);
    return cloneTransfer(nextTransfer);
  },

  async delete(transferId) {
    const resolvedTransferId = toTrimmedString(transferId);
    if (!resolvedTransferId) throw new Error("transferId is required.");

    const existing = ensureTransferExists(resolvedTransferId);
    transfers.delete(resolvedTransferId);
    return cloneTransfer(existing);
  },

  async exists(transferId) {
    const resolvedTransferId = toTrimmedString(transferId);
    if (!resolvedTransferId) throw new Error("transferId is required.");
    return transfers.has(resolvedTransferId);
  },

  async clear() {
    const clearedCount = transfers.size;
    transfers.clear();
    return {
      cleared: true,
      clearedCount,
      count: transfers.size,
    };
  },
};
