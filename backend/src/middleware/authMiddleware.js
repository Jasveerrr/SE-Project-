import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function authMiddleware(request, _response, next) {
  try {
    const header = request.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new AppError("Authentication required.", 401);
    const claims = jwt.verify(token, env.JWT_SECRET);
    if (!claims || typeof claims !== "object" || typeof claims.sub !== "string") {
      throw new AppError("Invalid authentication token.", 401);
    }
    request.user = { id: claims.sub, email: claims.email };
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError("Invalid authentication token.", 401));
  }
}
