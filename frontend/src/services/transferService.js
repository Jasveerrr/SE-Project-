import { apiClient } from "../api/apiClient.js";

export const transferService = {
  async list(params = {}) {
    const { data } = await apiClient.get("/transfers", { params });
    return data.transfers || [];
  },
  async get(transferId) {
    const { data } = await apiClient.get(`/transfers/${encodeURIComponent(transferId)}`);
    return data.transfer;
  },
  async start(payload) {
    const { data } = await apiClient.post("/transfers", payload);
    return data.transfer;
  },
  async update(transferId, payload) {
    const { data } = await apiClient.put(`/transfers/${encodeURIComponent(transferId)}`, payload);
    return data.transfer;
  },
  async cancel(transferId) {
    const { data } = await apiClient.patch(`/transfers/${encodeURIComponent(transferId)}/cancel`);
    return data.transfer;
  },
  async complete(transferId) {
    const { data } = await apiClient.patch(`/transfers/${encodeURIComponent(transferId)}/complete`);
    return data.transfer;
  },
  async remove(transferId) {
    await apiClient.delete(`/transfers/${encodeURIComponent(transferId)}`);
  },
};
