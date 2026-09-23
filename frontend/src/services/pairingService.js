import { apiClient } from "../api/apiClient.js";

export const pairingService = {
  async request(payload) {
    const { data } = await apiClient.post("/pairings/request", payload);
    return data.pairing;
  },
  async accept(pairingId) {
    const { data } = await apiClient.post("/pairings/accept", { pairingId });
    return data.pairing;
  },
  async reject(pairingId) {
    const { data } = await apiClient.post("/pairings/reject", { pairingId });
    return data.pairing;
  },
  async cancel(pairingId) {
    const { data } = await apiClient.post("/pairings/cancel", { pairingId });
    return data.pairing;
  },
  async status(pairingId) {
    const { data } = await apiClient.get(`/pairings/${encodeURIComponent(pairingId)}`);
    return data.pairing;
  },
};
