import { PairingService } from "../services/PairingService.js";

const DEFAULT_ERROR_MESSAGE = "An unexpected pairing error occurred.";

function getRequestPayload(request) {
  return request.body ?? {};
}

function getPairingId(request) {
  return request.params?.pairingId ?? request.body?.pairingId ?? request.query?.pairingId ?? null;
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

async function runPairingAction(response, statusCode, message, action) {
  try {
    const result = await action();
    return sendSuccess(response, statusCode, message, result);
  } catch (error) {
    return sendError(response, error);
  }
}

export const PairingController = {
  async sendPairingRequest(request, response) {
    return runPairingAction(response, 201, "Pairing request sent.", () =>
      PairingService.requestPairing({ payload: getRequestPayload(request) })
    );
  },

  async acceptPairingRequest(request, response) {
    return runPairingAction(response, 200, "Pairing request accepted.", () =>
      PairingService.acceptPairing({ payload: getRequestPayload(request) })
    );
  },

  async rejectPairingRequest(request, response) {
    return runPairingAction(response, 200, "Pairing request rejected.", () =>
      PairingService.rejectPairing({ payload: getRequestPayload(request) })
    );
  },

  async getPairingStatus(request, response) {
    try {
      const status = await PairingService.getPairingStatus({
        payload: {
          ...getRequestPayload(request),
          pairingId: getPairingId(request),
        },
      });
      return sendSuccess(response, 200, "Pairing status retrieved.", status);
    } catch (error) {
      return sendError(response, error);
    }
  },
};
