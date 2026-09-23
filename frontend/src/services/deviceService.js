import { apiClient } from "../api/apiClient.js";

export const deviceService = {
  async list() {
    const { data } = await apiClient.get("/devices");
    return data.devices || [];
  },
  async discover(payload) {
    const { data } = await apiClient.post("/devices/discover", payload);
    return data.device;
  },
  async refresh(payload) {
    const { data } = await apiClient.post("/devices/refresh", payload);
    return data.device;
  },
  async get(deviceId) {
    const { data } = await apiClient.get(`/devices/${encodeURIComponent(deviceId)}`);
    return data.device;
  },
  async update(deviceId, payload) {
    const { data } = await apiClient.put(`/devices/${encodeURIComponent(deviceId)}`, payload);
    return data.device;
  },
};
