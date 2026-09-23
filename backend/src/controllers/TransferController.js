import { TransferService } from "../services/TransferService.js";

function payload(request) {
  return { ...(request.body ?? {}), ...(request.params ?? {}), userId: request.user?.id };
}

function send(response, statusCode, result) {
  return response.status(statusCode).json({ success: true, ...result });
}

export const TransferController = {
  async startTransfer(request, response, next) {
    try {
      return send(response, 201, await TransferService.startTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
  async getTransfer(request, response, next) {
    try {
      return send(response, 200, await TransferService.getTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
  async getTransfers(request, response, next) {
    try {
      return send(
        response,
        200,
        await TransferService.getTransfers({ ...request.query, userId: request.user?.id })
      );
    } catch (error) {
      return next(error);
    }
  },
  async updateTransfer(request, response, next) {
    try {
      return send(response, 200, await TransferService.updateTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
  async cancelTransfer(request, response, next) {
    try {
      return send(response, 200, await TransferService.cancelTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
  async completeTransfer(request, response, next) {
    try {
      return send(response, 200, await TransferService.completeTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
  async deleteTransfer(request, response, next) {
    try {
      return send(response, 200, await TransferService.deleteTransfer(payload(request)));
    } catch (error) {
      return next(error);
    }
  },
};
