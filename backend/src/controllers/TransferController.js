import { TransferService } from "../services/TransferService.js";

const DEFAULT_ERROR_MESSAGE = "An unexpected transfer error occurred.";

function getTransferId(request) {
  return (
    request.params?.transferId ?? request.body?.transferId ?? request.query?.transferId ?? null
  );
}

function getRequestBody(request) {
  return request.body ?? {};
}

function sendNotFound(response, message = "Transfer not found.") {
  return response.status(404).json({
    success: false,
    message,
  });
}

function sendSuccess(response, statusCode, message, data, extra = {}) {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });
}

function sendError(response, error) {
  const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
  const statusCode =
    error?.statusCode ??
    (message.includes("not found") ? 404 : message.includes("required") ? 400 : 500);

  return response.status(statusCode).json({
    success: false,
    message,
  });
}

async function runControllerAction(response, statusCode, message, action) {
  try {
    const result = await action();
    return sendSuccess(response, statusCode, message, result, {
      count: Array.isArray(result) ? result.length : undefined,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

async function updateTransferStatus(request, response, status) {
  try {
    const transferId = getTransferId(request);
    const payload = {
      transferId,
      ...getRequestBody(request),
    };

    const transfer =
      status === "cancelled"
        ? await TransferService.cancelTransfer(payload)
        : await TransferService.completeTransfer(payload);

    return sendSuccess(response, 200, `Transfer ${status}.`, transfer);
  } catch (error) {
    return sendError(response, error);
  }
}

export const TransferController = {
  async startTransfer(request, response) {
    return runControllerAction(response, 201, "Transfer started.", () =>
      TransferService.startTransfer(getRequestBody(request))
    );
  },

  async getTransfer(request, response) {
    try {
      const transfer = await TransferService.getTransfer({
        transferId: getTransferId(request),
      });
      if (!transfer) {
        return sendNotFound(response);
      }

      return sendSuccess(response, 200, "Transfer retrieved.", transfer);
    } catch (error) {
      return sendError(response, error);
    }
  },

  async getTransfers(_request, response) {
    return runControllerAction(response, 200, "Transfers retrieved.", () =>
      TransferService.getTransfers()
    );
  },

  async updateTransfer(request, response) {
    try {
      const transferId = getTransferId(request);
      const transfer = await TransferService.updateTransfer({
        transferId,
        ...getRequestBody(request),
      });
      return sendSuccess(response, 200, "Transfer updated.", transfer);
    } catch (error) {
      return sendError(response, error);
    }
  },

  async cancelTransfer(request, response) {
    return updateTransferStatus(request, response, "cancelled");
  },

  async completeTransfer(request, response) {
    return updateTransferStatus(request, response, "completed");
  },

  async deleteTransfer(request, response) {
    try {
      const deletedTransfer = await TransferService.deleteTransfer({
        transferId: getTransferId(request),
      });
      return sendSuccess(response, 200, "Transfer deleted.", deletedTransfer);
    } catch (error) {
      return sendError(response, error);
    }
  },
};
