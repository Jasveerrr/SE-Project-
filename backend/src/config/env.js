import dotenv from "dotenv";
import { AppError } from "../utils/AppError.js";

dotenv.config();

function getString(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getRequiredString(name) {
  const value = getString(name);
  if (!value) {
    throw new AppError(`Missing required environment variable: ${name}.`, 500);
  }

  return value;
}

function getNumber(name, fallback) {
  const rawValue = getString(name);
  if (!rawValue) return fallback;

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new AppError(`Environment variable ${name} must be a valid number.`, 500);
  }

  return parsedValue;
}

function getPositiveNumber(name, fallback) {
  const value = getNumber(name, fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(`Environment variable ${name} must be a positive number.`, 500);
  }

  return value;
}

const env = Object.freeze({
  NODE_ENV: getString("NODE_ENV", "development"),
  PORT: getPositiveNumber("PORT", 5000),
  DATABASE_URL: getRequiredString("DATABASE_URL"),
  JWT_SECRET: getRequiredString("JWT_SECRET"),
  JWT_EXPIRES_IN: getString("JWT_EXPIRES_IN", "1d"),
  CLIENT_ORIGIN: getString("CLIENT_ORIGIN", "http://localhost:5173"),
  SOCKET_PING_TIMEOUT: getPositiveNumber("SOCKET_PING_TIMEOUT", 20000),
  SOCKET_PING_INTERVAL: getPositiveNumber("SOCKET_PING_INTERVAL", 25000),
  UPLOAD_DIRECTORY: getString("UPLOAD_DIRECTORY", "uploads"),
  MAX_FILE_SIZE: getPositiveNumber("MAX_FILE_SIZE", 52428800),
});

export { env };
