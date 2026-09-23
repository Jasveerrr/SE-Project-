import { apiClient } from "../api/apiClient.js";

export const authService = {
  async register(payload) {
    const { data } = await apiClient.post("/auth/register", payload);
    return data.data;
  },
  async login(payload) {
    const { data } = await apiClient.post("/auth/login", payload);
    return data.data;
  },
  async logout() {
    const { data } = await apiClient.post("/auth/logout");
    return data.data;
  },
  async getProfile() {
    const { data } = await apiClient.get("/auth/profile");
    return data.data;
  },
  async updateProfile(payload) {
    const { data } = await apiClient.put("/auth/profile", payload);
    return data.data;
  },
};
