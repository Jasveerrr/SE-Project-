const histories = new Map();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const toPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : Number.NaN;
const now = () => new Date().toISOString();

function buildResponse(message, history, extra = {}) {
  return { message, history: history ? { ...history } : null, ...extra };
}

function buildListResponse(message, items, extra = {}) {
  return { message, histories: items.map((item) => ({ ...item })), ...extra };
}

function assertPayload(payload) {
  if (!isPlainObject(payload)) throw new Error("payload must be an object.");
}

function requiredString(payload, fieldName) {
  const value = toTrimmedString(payload[fieldName]);
  if (!value) throw new Error(`${fieldName} is required.`);
  return value;
}

function optionalString(payload, fieldName, fallback = null) {
  const value = toTrimmedString(payload[fieldName]);
  return value || fallback;
}

function normalizeHistory(payload, existing = null) {
  const transferTime =
    payload.transferTime !== undefined
      ? toTrimmedString(payload.transferTime)
      : existing?.transferTime || now();
  const fileSize = toPositiveNumber(payload.fileSize ?? existing?.fileSize);

  if (!Number.isFinite(fileSize)) throw new Error("fileSize must be a non-negative number.");

  return {
    historyId:
      existing?.historyId || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    transferId: requiredString(payload, "transferId"),
    senderDeviceId: requiredString(payload, "senderDeviceId"),
    receiverDeviceId: requiredString(payload, "receiverDeviceId"),
    fileName: requiredString(payload, "fileName"),
    fileSize,
    status: requiredString(payload, "status"),
    transferTime,
    createdAt: existing?.createdAt || now(),
  };
}

function getHistoryOrThrow(historyId) {
  const history = histories.get(historyId);
  if (!history) throw new Error(`History not found: ${historyId}.`);
  return history;
}

function toOrderedList(source) {
  return Array.from(source.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export const HistoryService = {
  async addHistory({ payload } = {}) {
    assertPayload(payload);
    const history = normalizeHistory(payload);

    if (histories.has(history.historyId)) {
      throw new Error(`History already exists: ${history.historyId}.`);
    }

    histories.set(history.historyId, history);
    return buildResponse("History added.", history, { count: histories.size });
  },

  async getHistory({ payload } = {}) {
    if (payload !== undefined) assertPayload(payload);

    const limit = payload?.limit === undefined ? null : toPositiveNumber(payload.limit);
    const offset = payload?.offset === undefined ? 0 : toPositiveNumber(payload.offset);

    if (payload?.limit !== undefined && !Number.isFinite(limit))
      throw new Error("limit must be a non-negative number.");
    if (payload?.offset !== undefined && !Number.isFinite(offset))
      throw new Error("offset must be a non-negative number.");

    const items = toOrderedList(histories);
    const pagedItems = items.slice(offset, limit === null ? undefined : offset + limit);
    return buildListResponse("History retrieved.", pagedItems, {
      count: items.length,
      total: items.length,
      offset,
      limit,
    });
  },

  async getHistoryByTransferId({ payload } = {}) {
    assertPayload(payload);
    const transferId = requiredString(payload, "transferId");
    const items = toOrderedList(histories).filter((history) => history.transferId === transferId);

    return buildListResponse("History retrieved by transferId.", items, {
      count: items.length,
      transferId,
    });
  },

  async deleteHistory({ payload } = {}) {
    assertPayload(payload);

    const historyId = optionalString(payload, "historyId");
    const transferId = optionalString(payload, "transferId");

    if (!historyId && !transferId) {
      throw new Error("historyId or transferId is required.");
    }

    if (historyId) {
      const history = getHistoryOrThrow(historyId);
      histories.delete(historyId);
      return buildResponse("History deleted.", history, { deleted: true, count: histories.size });
    }

    const deletedItems = [];
    for (const [key, history] of histories.entries()) {
      if (history.transferId === transferId) {
        deletedItems.push({ ...history });
        histories.delete(key);
      }
    }

    return buildListResponse("History deleted by transferId.", deletedItems, {
      deleted: deletedItems.length > 0,
      deletedCount: deletedItems.length,
      transferId,
      count: histories.size,
    });
  },

  async clearHistory() {
    const clearedCount = histories.size;
    histories.clear();
    return {
      message: "History cleared.",
      cleared: true,
      clearedCount,
      count: histories.size,
      histories: [],
    };
  },
};
