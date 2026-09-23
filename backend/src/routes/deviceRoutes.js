import { Router } from "express";
import { DeviceController } from "../controllers/DeviceController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export const deviceRoutes = Router();

deviceRoutes.use(authMiddleware);
deviceRoutes.post("/devices/discover", DeviceController.discoverDevice);
deviceRoutes.post("/devices/refresh", DeviceController.refreshDevice);
deviceRoutes.get("/devices", DeviceController.getDevices);
deviceRoutes.get("/devices/:deviceId", DeviceController.getDevice);
deviceRoutes.put("/devices/:deviceId", DeviceController.updateDevice);
deviceRoutes.delete("/devices/:deviceId", DeviceController.removeDisconnectedDevice);
