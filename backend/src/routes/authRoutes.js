import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";

export const authRoutes = Router();

authRoutes.post("/auth/register", AuthController.register);
authRoutes.post("/auth/login", AuthController.login);
authRoutes.post("/auth/logout", AuthController.logout);
authRoutes.get("/auth/profile", AuthController.getProfile);
authRoutes.put("/auth/profile", AuthController.updateProfile);
