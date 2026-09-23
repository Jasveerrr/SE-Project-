import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/authRoutes.js";
import { deviceRoutes } from "./routes/deviceRoutes.js";
import { transferRoutes } from "./routes/transferRoutes.js";
import { pairingRoutes } from "./routes/PairingRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: `${env.MAX_FILE_SIZE}b` }));
app.use(express.urlencoded({ extended: true, limit: `${env.MAX_FILE_SIZE}b` }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api", authRoutes);
app.use("/api", deviceRoutes);
app.use("/api", transferRoutes);
app.use("/api", pairingRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
