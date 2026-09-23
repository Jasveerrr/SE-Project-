import { DatabaseService } from "./DatabaseService.js";
import { AppError } from "../utils/AppError.js";

const TRANSFER_STATUSES = new Set(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "FAILED"]);
const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "FAILED"]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

function getInvocation(input = {}) {
  if (isPlainObject(input) && Object.prototype.hasOwnProperty.call(input, "payload")) {
    return { socket: input.socket, payload: input.payload };
  }

  return { socket: undefined, payload: input };
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError("payload must be an object.", 400);
  }
}

function resolveTransferId(payload) {
  const transferId = toTrimmedString(payload.transferId ?? payload.id ?? payload.transfer?.id);
  if (!transferId) {
    throw new AppError("transferId is required.", 400);
  }
  return transferId;
}

function resolveDeviceId(payload, keys, fieldName) {
  for (const key of keys) {
    const value = toTrimmedString(payload[key]);
    if (value) return value;
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

function resolveUserId(payload, required = false) {
  const userId = toTrimmedString(payload.userId ?? payload.user?.id ?? payload.user?.userId);
  if (required && !userId) throw new AppError("Authentication required.", 401);
  return userId || undefined;
}

function resolveFileName(payload, required = true) {
  const value = toTrimmedString(payload.fileName ?? payload.name ?? payload.file?.name);
  if (required && !value) throw new AppError("fileName is required.", 400);
  if (value.length > 255) {
    throw new AppError("fileName cannot exceed 255 characters.", 400);
  }
  return value;
}

function resolveNonNegativeInteger(value, fieldName) {
  if (typeof value === "bigint") {
    if (value < 0n) throw new AppError(`${fieldName} must be a non-negative integer.`, 400);
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AppError(`${fieldName} must be a non-negative integer.`, 400);
    }
    return BigInt(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }

  throw new AppError(`${fieldName} must be a non-negative integer.`, 400);
}

function resolveFileSize(payload, required = true) {
  const value = payload.fileSize ?? payload.size ?? payload.file?.size;
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError("fileSize is required.", 400);
    return undefined;
  }
  return resolveNonNegativeInteger(value, "fileSize");
}

function resolveProgress(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new AppError("progress must be an integer between 0 and 100.", 400);
  }
  return value;
}

function resolveStatus(value) {
  const status = toTrimmedString(value).toUpperCase();
  if (!TRANSFER_STATUSES.has(status)) {
    throw new AppError(`Invalid transfer status: ${value}.`, 400);
  }
  return status;
}

function calculateProgress(bytesTransferred, fileSize) {
  if (fileSize === 0n) return 0;
  return Number((bytesTransferred * 100n) / fileSize);
}

function toJsonNumber(value) {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

function serializeDevice(device) {
  return device?.deviceId ?? device?.id ?? null;
}

function serializeHistory(history) {
  if (!history) return null;
  return { ...history, fileSize: toJsonNumber(history.fileSize) };
}

function serializeTransfer(transfer) {
  if (!transfer) return null;

  const senderDeviceId = serializeDevice(transfer.senderDevice) ?? transfer.senderDeviceId;
  const receiverDeviceId = serializeDevice(transfer.receiverDevice) ?? transfer.receiverDeviceId;

  return {
    id: transfer.id,
    transferId: transfer.transferId,
    senderDeviceId,
    receiverDeviceId,
    sourceDeviceId: senderDeviceId,
    targetDeviceId: receiverDeviceId,
    fileName: transfer.fileName,
    fileSize: toJsonNumber(transfer.fileSize),
    bytesTransferred: toJsonNumber(transfer.bytesTransferred),
    progress: transfer.progress,
    status: transfer.status,
    socketId: transfer.socketId,
    createdAt: transfer.createdAt,
    updatedAt: transfer.updatedAt,
    history: serializeHistory(transfer.history),
  };
}

function buildResponse(message, transfer, extra = {}) {
  return { message, transfer: serializeTransfer(transfer), ...extra };
}

function handleDatabaseError(error, fallbackMessage) {
  if (error instanceof AppError) throw error;
  if (error?.code === "P2025") throw new AppError("Transfer not found.", 404);
  if (error?.code === "P2002") throw new AppError("Transfer already exists.", 409);
  throw new AppError(fallbackMessage, 500);
}

async function getPrismaClient() {
  return DatabaseService.getClient();
}

async function findDevice(prisma, deviceId) {
  return prisma.device.findFirst({
    where: { OR: [{ id: deviceId }, { deviceId }] },
  });
}

async function resolveDevices(prisma, payload) {
  const senderDeviceId = resolveSenderDeviceId(payload);
  const receiverDeviceId = resolveReceiverDeviceId(payload);
  if (senderDeviceId === receiverDeviceId) {
    throw new AppError("senderDeviceId and receiverDeviceId must be different.", 400);
  }

  const [senderDevice, receiverDevice] = await Promise.all([
    findDevice(prisma, senderDeviceId),
    findDevice(prisma, receiverDeviceId),
  ]);

  if (!senderDevice) throw new AppError("Sender device not found.", 404);
  if (!receiverDevice) throw new AppError("Receiver device not found.", 404);
  if (senderDevice.id === receiverDevice.id) {
    throw new AppError("senderDeviceId and receiverDeviceId must be different.", 400);
  }

  return { senderDevice, receiverDevice };
}

function assertTransferAccess(transfer, userId) {
  if (!userId) return;
  const ownsTransfer = [transfer.senderDevice?.userId, transfer.receiverDevice?.userId].includes(
    userId
  );
  if (!ownsTransfer) throw new AppError("You are not authorized to access this transfer.", 403);
}

const transferInclude = {
  senderDevice: true,
  receiverDevice: true,
  history: true,
};

async function findTransfer(prisma, transferId) {
  return prisma.transfer.findFirst({
    where: { OR: [{ transferId }, { id: transferId }] },
    include: transferInclude,
  });
}

async function getTransferOrThrow(prisma, transferId) {
  const transfer = await findTransfer(prisma, transferId);
  if (!transfer) throw new AppError("Transfer not found.", 404);
  return transfer;
}

function assertMutable(transfer, action) {
  if (TERMINAL_STATUSES.has(transfer.status)) {
    throw new AppError(`Cannot ${action} a transfer that is already ${transfer.status}.`, 400);
  }
}

function assertTransition(currentStatus, nextStatus) {
  if (!TRANSFER_STATUSES.has(nextStatus)) {
    throw new AppError(`Invalid transfer status: ${nextStatus}.`, 400);
  }
  if (currentStatus === nextStatus) return;

  const allowed = {
    PENDING: new Set(["ACTIVE", "FAILED"]),
    ACTIVE: new Set(["FAILED"]),
  };
  if (!allowed[currentStatus]?.has(nextStatus)) {
    throw new AppError(
      `Cannot change transfer status from ${currentStatus} to ${nextStatus}.`,
      400
    );
  }
}

function buildHistoryData(transfer, status) {
  return {
    transferId: transfer.id,
    senderDeviceId: transfer.senderDeviceId,
    receiverDeviceId: transfer.receiverDeviceId,
    fileName: transfer.fileName,
    fileSize: transfer.fileSize,
    status,
  };
}

async function updateTransferRecord(prisma, transfer, data, message) {
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.transfer.update({
        where: { id: transfer.id },
        data,
        include: transferInclude,
      });

      if (TERMINAL_STATUSES.has(result.status)) {
        await transaction.transferHistory.upsert({
          where: { transferId: result.id },
          create: buildHistoryData(result, result.status),
          update: buildHistoryData(result, result.status),
        });
      }

      return transaction.transfer.findUnique({
        where: { id: result.id },
        include: transferInclude,
      });
    });

    return buildResponse(message, updated, { status: updated.status });
  } catch (error) {
    handleDatabaseError(error, "Unable to update transfer.");
  }
}

export const TransferService = {
  async startTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const fileName = resolveFileName(payload);
    const fileSize = resolveFileSize(payload);
    const prisma = await getPrismaClient();

    try {
      const { senderDevice, receiverDevice } = await resolveDevices(prisma, payload);
      if (userId && ![senderDevice.userId, receiverDevice.userId].includes(userId)) {
        throw new AppError("You are not authorized to use these devices.", 403);
      }
      const transfer = await prisma.transfer.create({
        data: {
          transferId,
          senderDeviceId: senderDevice.id,
          receiverDeviceId: receiverDevice.id,
          fileName,
          fileSize,
          bytesTransferred: 0n,
          progress: 0,
          status: "ACTIVE",
          socketId: toTrimmedString(socket?.id ?? payload.socketId) || null,
        },
        include: transferInclude,
      });

      return buildResponse("Transfer started.", transfer, { status: transfer.status });
    } catch (error) {
      handleDatabaseError(error, "Unable to start transfer.");
    }
  },

  async getTransfers(input = {}) {
    const { socket, payload } = getInvocation(input);
    const filters = isPlainObject(payload) ? payload : {};
    const userId = resolveUserId(filters, !socket);
    const prisma = await getPrismaClient();
    const where = { AND: [] };
    if (userId) {
      where.AND.push({
        OR: [{ senderDevice: { userId } }, { receiverDevice: { userId } }],
      });
    }

    if (filters.status !== undefined) where.status = resolveStatus(filters.status);
    if (filters.senderDeviceId) {
      where.AND.push({
        senderDevice: { deviceId: toTrimmedString(filters.senderDeviceId) },
      });
    }
    if (filters.receiverDeviceId) {
      where.AND.push({
        receiverDevice: { deviceId: toTrimmedString(filters.receiverDeviceId) },
      });
    }

    if (!where.AND.length) delete where.AND;

    const take =
      filters.limit === undefined ? undefined : resolveNonNegativeInteger(filters.limit, "limit");
    const skip =
      filters.offset === undefined
        ? undefined
        : resolveNonNegativeInteger(filters.offset, "offset");

    try {
      const transfers = await prisma.transfer.findMany({
        where,
        include: transferInclude,
        orderBy: { createdAt: "desc" },
        ...(take === undefined ? {} : { take: Number(take) }),
        ...(skip === undefined ? {} : { skip: Number(skip) }),
      });
      return {
        message: "Transfers retrieved.",
        transfers: transfers.map(serializeTransfer),
        count: transfers.length,
      };
    } catch (error) {
      handleDatabaseError(error, "Unable to fetch transfers.");
    }
  },

  async getTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      return buildResponse("Transfer retrieved.", transfer, { status: transfer.status });
    } catch (error) {
      handleDatabaseError(error, "Unable to fetch transfer.");
    }
  },

  async updateTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      assertMutable(transfer, "update");
      if (socket?.id && transfer.socketId && socket.id !== transfer.socketId) {
        throw new AppError("This transfer belongs to another socket connection.", 403);
      }

      const data = {};
      if (payload.fileName !== undefined) data.fileName = resolveFileName(payload);
      if (payload.fileSize !== undefined) {
        const fileSize = resolveFileSize(payload, false);
        if (fileSize < transfer.bytesTransferred) {
          throw new AppError("fileSize cannot be less than bytesTransferred.", 400);
        }
        data.fileSize = fileSize;
      }

      const nextFileSize = data.fileSize ?? transfer.fileSize;
      if (payload.bytesTransferred !== undefined) {
        const bytesTransferred = resolveNonNegativeInteger(
          payload.bytesTransferred,
          "bytesTransferred"
        );
        if (bytesTransferred > nextFileSize) {
          throw new AppError("bytesTransferred cannot exceed fileSize.", 400);
        }
        data.bytesTransferred = bytesTransferred;
        data.progress = calculateProgress(bytesTransferred, nextFileSize);
        if (payload.progress !== undefined && resolveProgress(payload.progress) !== data.progress) {
          throw new AppError("progress does not match bytesTransferred and fileSize.", 400);
        }
      } else if (payload.progress !== undefined) {
        const progress = resolveProgress(payload.progress);
        if (nextFileSize === 0n && progress !== 0) {
          throw new AppError("progress must be 0 when fileSize is 0.", 400);
        }
        data.progress = progress;
        data.bytesTransferred = nextFileSize === 0n ? 0n : (nextFileSize * BigInt(progress)) / 100n;
      }

      if (payload.status !== undefined) {
        const status = resolveStatus(payload.status);
        assertTransition(transfer.status, status);
        data.status = status;
      }
      if (payload.socketId !== undefined) {
        data.socketId = toTrimmedString(payload.socketId) || null;
      }

      if (!Object.keys(data).length) {
        throw new AppError("No transfer fields provided for update.", 400);
      }
      if (data.progress === 100 && nextFileSize > 0n) {
        throw new AppError("Use completeTransfer to complete a transfer.", 400);
      }

      return updateTransferRecord(prisma, transfer, data, "Transfer updated.");
    } catch (error) {
      handleDatabaseError(error, "Unable to update transfer.");
    }
  },

  async updateTransferProgress(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      assertMutable(transfer, "update");
      if (socket?.id && transfer.socketId && socket.id !== transfer.socketId) {
        throw new AppError("This transfer belongs to another socket connection.", 403);
      }

      let bytesTransferred = transfer.bytesTransferred;
      if (payload.bytesTransferred !== undefined) {
        bytesTransferred = resolveNonNegativeInteger(payload.bytesTransferred, "bytesTransferred");
      } else if (payload.deltaBytes !== undefined || payload.chunkBytes !== undefined) {
        const delta = resolveNonNegativeInteger(
          payload.deltaBytes ?? payload.chunkBytes,
          "deltaBytes"
        );
        bytesTransferred += delta;
      } else if (payload.progress !== undefined) {
        const progress = resolveProgress(payload.progress);
        if (transfer.fileSize === 0n && progress !== 0) {
          throw new AppError("progress must be 0 when fileSize is 0.", 400);
        }
        bytesTransferred =
          transfer.fileSize === 0n ? 0n : (transfer.fileSize * BigInt(progress)) / 100n;
      } else {
        throw new AppError("Provide bytesTransferred, deltaBytes, or progress.", 400);
      }

      const calculatedProgress = calculateProgress(bytesTransferred, transfer.fileSize);
      if (
        payload.progress !== undefined &&
        resolveProgress(payload.progress) !== calculatedProgress
      ) {
        throw new AppError("progress does not match bytesTransferred and fileSize.", 400);
      }
      if (bytesTransferred > transfer.fileSize) {
        throw new AppError("bytesTransferred cannot exceed fileSize.", 400);
      }
      if (bytesTransferred === transfer.fileSize && transfer.fileSize > 0n) {
        throw new AppError("Use completeTransfer to complete a transfer.", 400);
      }

      return updateTransferRecord(
        prisma,
        transfer,
        {
          bytesTransferred,
          progress: calculatedProgress,
          status: "ACTIVE",
        },
        "Transfer progress updated."
      );
    } catch (error) {
      handleDatabaseError(error, "Unable to update transfer progress.");
    }
  },

  async cancelTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      assertMutable(transfer, "cancel");
      if (socket?.id && transfer.socketId && socket.id !== transfer.socketId) {
        throw new AppError("This transfer belongs to another socket connection.", 403);
      }
      return updateTransferRecord(prisma, transfer, { status: "CANCELLED" }, "Transfer cancelled.");
    } catch (error) {
      handleDatabaseError(error, "Unable to cancel transfer.");
    }
  },

  async completeTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      assertMutable(transfer, "complete");
      if (socket?.id && transfer.socketId && socket.id !== transfer.socketId) {
        throw new AppError("This transfer belongs to another socket connection.", 403);
      }
      return updateTransferRecord(
        prisma,
        transfer,
        { bytesTransferred: transfer.fileSize, progress: 100, status: "COMPLETED" },
        "Transfer completed."
      );
    } catch (error) {
      handleDatabaseError(error, "Unable to complete transfer.");
    }
  },

  async deleteTransfer(input = {}) {
    const { socket, payload } = getInvocation(input);
    assertPayload(payload);
    const userId = resolveUserId(payload, !socket);
    const transferId = resolveTransferId(payload);
    const prisma = await getPrismaClient();

    try {
      const transfer = await getTransferOrThrow(prisma, transferId);
      assertTransferAccess(transfer, userId);
      if (transfer.history) {
        throw new AppError("Transfers with history cannot be deleted.", 400);
      }
      const deleted = await prisma.transfer.delete({
        where: { id: transfer.id },
        include: transferInclude,
      });
      return buildResponse("Transfer deleted.", deleted, {
        status: deleted.status,
        deleted: true,
      });
    } catch (error) {
      handleDatabaseError(error, "Unable to delete transfer.");
    }
  },
};
