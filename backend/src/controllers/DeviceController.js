import { DeviceService } from "../services/DeviceService.js";

function payload(request) {
  return { ...(request.body ?? {}), ...(request.params ?? {}), userId: request.user?.id };
}

function send(response, statusCode, result) {
  return response.status(statusCode).json({ success: true, ...result });
}

export const DeviceController = {
  async discoverDevice(request, response, next) {
    try {
      return send(
        response,
        201,
        await DeviceService.discoverDevices({ payload: payload(request) })
      );
    } catch (error) {
      return next(error);
    }
  },
  async refreshDevice(request, response, next) {
    try {
      return send(response, 200, await DeviceService.refreshDevices({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async getDevice(request, response, next) {
    try {
      return send(response, 200, await DeviceService.getDevice({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async getDevices(request, response, next) {
    try {
      const devices = await DeviceService.listDevices({ payload: { userId: request.user?.id } });
      return send(response, 200, { message: "Devices retrieved.", devices, count: devices.length });
    } catch (error) {
      return next(error);
    }
  },
  async updateDevice(request, response, next) {
    try {
      return send(response, 200, await DeviceService.updateDevice({ payload: payload(request) }));
    } catch (error) {
      return next(error);
    }
  },
  async removeDisconnectedDevice(request, response, next) {
    try {
      return send(
        response,
        200,
        await DeviceService.removeDisconnectedDevice({ payload: payload(request) })
      );
    } catch (error) {
      return next(error);
    }
  },
};
