import { DeviceService } from "../services/DeviceService.js";

const DEFAULT_ERROR_MESSAGE = "An unexpected device error occurred.";

function getRequestPayload(request) {
  return request.body ?? {};
}

function getDeviceId(request) {
  return request.params?.deviceId ?? request.body?.deviceId ?? request.query?.deviceId ?? null;
}

function getQueryPayload(request) {
  return request.query ?? {};
}

function buildDevicePayload(request) {
  return {
    ...getRequestPayload(request),
    deviceId: getDeviceId(request),
  };
}

function sendNotImplemented(response, message) {
  return response.status(501).json({
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

async function runDeviceAction(response, statusCode, message, action) {
  try {
    const result = await action();
    return sendSuccess(response, statusCode, message, result, {
      count: Array.isArray(result) ? result.length : undefined,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

export const DeviceController = {
  async discoverDevice(request, response) {
    return runDeviceAction(response, 201, "Device discovered.", () =>
      DeviceService.discoverDevices({ payload: getRequestPayload(request) })
    );
  },

  async refreshDevice(request, response) {
    return runDeviceAction(response, 200, "Device refreshed.", () =>
      DeviceService.refreshDevices({ payload: getRequestPayload(request) })
    );
  },

  async getDevice(request, response) {
    try {
      const device = await DeviceService.getDevice({
        payload: buildDevicePayload(request),
      });
      return sendSuccess(response, 200, "Device retrieved.", device);
    } catch (error) {
      return sendError(response, error);
    }
  },

  async getDevices(request, response) {
    return sendNotImplemented(response, "Device listing is not available in DeviceService.");
  },

  async updateDevice(request, response) {
    try {
      const device = await DeviceService.updateDevice({
        payload: buildDevicePayload(request),
      });
      return sendSuccess(response, 200, "Device updated.", device);
    } catch (error) {
      return sendError(response, error);
    }
  },

  async removeDisconnectedDevice(request, response) {
    try {
      const device = await DeviceService.removeDisconnectedDevice({
        payload: buildDevicePayload(request),
      });
      return sendSuccess(response, 200, "Device removed.", device);
    } catch (error) {
      return sendError(response, error);
    }
  },
};
