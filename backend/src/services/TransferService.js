const transfers = new Map();
const FINAL_STATES = new Set(["cancelled", "completed"]);
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const toNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
const now = () => new Date().toISOString();

function getTransferId(payload) {
  const transferId = toTrimmedString(payload.transferId ?? payload.id ?? payload.transfer?.id);
  if (!transferId) throw new Error("transferId is required.");
  return transferId;
}

function getTransferOrThrow(transferId) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error(`Transfer not found: ${transferId}.`);
  return transfer;
}

function assertMutableTransfer(transfer, action) {
  if (FINAL_STATES.has(transfer.status))
    throw new Error(`Cannot ${action} a transfer that is already ${transfer.status}.`);
}

function assertOwnedBySocket(transfer, socket) {
  if (transfer.socketId && socket?.id && transfer.socketId !== socket.id)
    throw new Error("This transfer belongs to another socket connection.");
}

function resolveFileName(payload) {
  const fileName = toTrimmedString(payload.fileName ?? payload.name ?? payload.file?.name);
  if (!fileName) throw new Error("fileName is required.");
  return fileName;
}

function resolveFileSize(payload) {
  const fileSize = toNumber(payload.fileSize ?? payload.size ?? payload.file?.size);
  if (!Number.isFinite(fileSize) || fileSize <= 0)
    throw new Error("fileSize must be a positive number.");
  return fileSize;
}

function buildResponse(message, transfer, extra = {}) {
  return { message, transfer: { ...transfer }, ...extra };
}

function updateProgressFromPayload(transfer, payload) {
  const absoluteBytes = toNumber(payload.bytesTransferred ?? payload.transferredBytes);
  const deltaBytes = toNumber(payload.deltaBytes ?? payload.chunkBytes ?? payload.bytesDelta);
  const progress = toNumber(payload.progress);

  if (Number.isFinite(absoluteBytes) && absoluteBytes >= 0) {
    transfer.bytesTransferred = Math.min(absoluteBytes, transfer.fileSize);
  } else if (Number.isFinite(deltaBytes) && deltaBytes >= 0) {
    transfer.bytesTransferred = Math.min(transfer.bytesTransferred + deltaBytes, transfer.fileSize);
  } else if (Number.isFinite(progress) && progress >= 0 && progress <= 100) {
    transfer.progress = progress;
    if (transfer.fileSize > 0)
      transfer.bytesTransferred = Math.min(
        transfer.fileSize,
        Math.round((transfer.fileSize * progress) / 100)
      );
    return;
  } else {
    throw new Error("Provide bytesTransferred, deltaBytes, or progress.");
  }

  transfer.progress =
    transfer.fileSize > 0
      ? Math.min(100, Math.round((transfer.bytesTransferred / transfer.fileSize) * 100))
      : transfer.progress;
}

export const TransferService = {
  async startTransfer({ socket, payload } = {}) {
    if (!socket || typeof socket.id !== "string")
      throw new Error("A valid socket connection is required to start a transfer.");
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");

    const transferId = getTransferId(payload);
    if (transfers.has(transferId)) throw new Error(`Transfer already exists: ${transferId}.`);

    const transfer = {
      id: transferId,
      fileName: resolveFileName(payload),
      fileSize: resolveFileSize(payload),
      bytesTransferred: 0,
      progress: 0,
      status: "active",
      socketId: socket.id,
      sourceDeviceId:
        toTrimmedString(payload.sourceDeviceId ?? payload.deviceId ?? payload.fromDeviceId) || null,
      targetDeviceId: toTrimmedString(payload.targetDeviceId ?? payload.toDeviceId) || null,
      createdAt: now(),
      updatedAt: now(),
    };

    transfers.set(transferId, transfer);
    return buildResponse("Transfer started.", transfer, { status: transfer.status });
  },

  async updateTransferProgress({ socket, payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const transfer = getTransferOrThrow(getTransferId(payload));
    assertOwnedBySocket(transfer, socket);
    assertMutableTransfer(transfer, "update");

    updateProgressFromPayload(transfer, payload);
    transfer.status = "active";
    transfer.updatedAt = now();
    return buildResponse("Transfer progress updated.", transfer, { status: transfer.status });
  },

  async cancelTransfer({ socket, payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const transfer = getTransferOrThrow(getTransferId(payload));
    assertOwnedBySocket(transfer, socket);
    assertMutableTransfer(transfer, "cancel");

    transfer.status = "cancelled";
    transfer.cancelledAt = now();
    transfer.updatedAt = transfer.cancelledAt;
    return buildResponse("Transfer cancelled.", transfer, { status: transfer.status });
  },

  async completeTransfer({ socket, payload } = {}) {
    if (!isPlainObject(payload)) throw new Error("payload must be an object.");
    const transfer = getTransferOrThrow(getTransferId(payload));
    assertOwnedBySocket(transfer, socket);
    assertMutableTransfer(transfer, "complete");

    transfer.bytesTransferred = transfer.fileSize;
    transfer.progress = 100;
    transfer.status = "completed";
    transfer.completedAt = now();
    transfer.updatedAt = transfer.completedAt;
    return buildResponse("Transfer completed.", transfer, { status: transfer.status });
  },
};
