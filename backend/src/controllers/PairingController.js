import { PairingService } from "../services/PairingService.js";

function payload(request) {
  return { ...(request.body ?? {}), ...(request.params ?? {}), userId: request.user?.id };
}

function send(response, statusCode, result) {
  return response.status(statusCode).json({ success: true, ...result });
}

export const PairingController = {
  async sendPairingRequest(request, response, next) {
    try {
      return send(
        response,
        201,
        await PairingService.requestPairing({ payload: payload(request) })
      );
    } catch (error) {
      return next(error);
    }
  },
  async acceptPairingRequest(request, response, next) {
    try {
      return send(response, 200, await PairingService.acceptPairing({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async rejectPairingRequest(request, response, next) {
    try {
      return send(response, 200, await PairingService.rejectPairing({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async cancelPairingRequest(request, response, next) {
    try {
      return send(response, 200, await PairingService.cancelPairing({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async getPairingStatus(request, response, next) {
    try {
      return send(
        response,
        200,
        await PairingService.getPairingStatus({ payload: payload(request) })
      );
    } catch (error) {
      return next(error);
    }
  },
};
