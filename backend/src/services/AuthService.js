import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { DatabaseService } from "./DatabaseService.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 12;
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return toTrimmedString(value).toLowerCase();
}

function normalizeDisplayName(value) {
  const displayName = toTrimmedString(value);
  if (!displayName) return null;
  if (displayName.length > 100) {
    throw new AppError("displayName cannot exceed 100 characters.", 400);
  }

  return displayName;
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError("A valid email address is required.", 400);
  }
}

function validatePassword(password) {
  if (typeof password !== "string") {
    throw new AppError("Password is required.", 400);
  }

  if (password.length < 8 || password.length > 128) {
    throw new AppError("Password must be between 8 and 128 characters.", 400);
  }

  return password;
}

function resolveAuthPayload(payload = {}) {
  return payload?.body && typeof payload.body === "object"
    ? { ...payload.body, ...payload }
    : payload;
}

function resolveUserId(payload = {}) {
  return toTrimmedString(payload.user?.id ?? payload.user?.userId ?? payload.userId);
}

function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildResponse(statusCode, message, data) {
  return { statusCode, message, data };
}

async function getPrismaClient() {
  return DatabaseService.getClient();
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function handlePrismaError(error, fallbackMessage) {
  if (error?.code === "P2002") {
    throw new AppError("Resource already exists.", 409);
  }

  throw error instanceof AppError ? error : new AppError(fallbackMessage, 500);
}

async function findUserByEmail(prisma, email, includePasswordHash = false) {
  return prisma.user.findUnique({
    where: { email },
    select: includePasswordHash ? { ...SAFE_USER_SELECT, passwordHash: true } : SAFE_USER_SELECT,
  });
}

export const AuthService = {
  async register(payload = {}) {
    try {
      const input = resolveAuthPayload(payload);
      const email = normalizeEmail(input.email);
      const password = validatePassword(input.password);
      const displayName = normalizeDisplayName(input.displayName);

      validateEmail(email);

      const prisma = await getPrismaClient();
      const existingUser = await findUserByEmail(prisma, email);
      if (existingUser) {
        throw new AppError("A user with this email already exists.", 409);
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: { email, passwordHash, displayName },
        select: SAFE_USER_SELECT,
      });

      return buildResponse(201, "User registered.", { user: toSafeUser(user) });
    } catch (error) {
      handlePrismaError(error, "Unable to register user.");
    }
  },

  async login(payload = {}) {
    try {
      const input = resolveAuthPayload(payload);
      const email = normalizeEmail(input.email);
      const password = validatePassword(input.password);

      validateEmail(email);

      const prisma = await getPrismaClient();
      const user = await findUserByEmail(prisma, email, true);
      if (!user || !user.isActive) {
        throw new AppError("Invalid email or password.", 401);
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        throw new AppError("Invalid email or password.", 401);
      }

      const [updatedUser, token] = await Promise.all([
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
          select: SAFE_USER_SELECT,
        }),
        Promise.resolve(signToken(user)),
      ]);

      return buildResponse(200, "Login successful.", {
        token,
        user: toSafeUser(updatedUser),
      });
    } catch (error) {
      handlePrismaError(error, "Unable to login.");
    }
  },

  async logout(payload = {}) {
    const userId = resolveUserId(payload);
    if (!userId) {
      throw new AppError("Authentication required.", 401);
    }

    return buildResponse(200, "Logout successful.", { loggedOut: true });
  },

  async getProfile(payload = {}) {
    try {
      const userId = resolveUserId(payload);
      if (!userId) {
        throw new AppError("Authentication required.", 401);
      }

      const prisma = await getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT,
      });

      if (!user) {
        throw new AppError("User not found.", 404);
      }

      return buildResponse(200, "Profile retrieved.", { user: toSafeUser(user) });
    } catch (error) {
      handlePrismaError(error, "Unable to fetch profile.");
    }
  },

  async updateProfile(payload = {}) {
    try {
      const input = resolveAuthPayload(payload);
      const userId = resolveUserId(input);
      if (!userId) {
        throw new AppError("Authentication required.", 401);
      }

      const prisma = await getPrismaClient();
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT,
      });

      if (!currentUser) {
        throw new AppError("User not found.", 404);
      }

      const nextEmail = input.email !== undefined ? normalizeEmail(input.email) : undefined;
      const nextDisplayName = input.displayName !== undefined ? input.displayName : undefined;
      const data = {};

      if (nextEmail !== undefined) {
        validateEmail(nextEmail);
        if (nextEmail !== currentUser.email) {
          const existingUser = await findUserByEmail(prisma, nextEmail);
          if (existingUser && existingUser.id !== userId) {
            throw new AppError("A user with this email already exists.", 409);
          }
          data.email = nextEmail;
        }
      }

      if (nextDisplayName !== undefined) {
        const displayName = toTrimmedString(input.displayName);
        if (!displayName) {
          throw new AppError("displayName cannot be empty.", 400);
        }
        if (displayName.length > 100) {
          throw new AppError("displayName cannot exceed 100 characters.", 400);
        }
        data.displayName = displayName;
      }

      if (!Object.keys(data).length) {
        throw new AppError("No profile fields provided for update.", 400);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select: SAFE_USER_SELECT,
      });

      return buildResponse(200, "Profile updated.", { user: toSafeUser(updatedUser) });
    } catch (error) {
      handlePrismaError(error, "Unable to update profile.");
    }
  },
};
