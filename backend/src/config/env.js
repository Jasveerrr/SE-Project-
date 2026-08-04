import dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db",
  JWT_SECRET: process.env.JWT_SECRET ?? "change-me",
};
