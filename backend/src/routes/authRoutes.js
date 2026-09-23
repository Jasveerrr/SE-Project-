import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export const authRoutes = Router();

authRoutes.post("/auth/register", AuthController.register);
authRoutes.post("/auth/login", AuthController.login);
authRoutes.post("/auth/logout", authMiddleware, AuthController.logout);
authRoutes.get("/auth/profile", authMiddleware, AuthController.getProfile);
authRoutes.put("/auth/profile", authMiddleware, AuthController.updateProfile);
