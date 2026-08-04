import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
