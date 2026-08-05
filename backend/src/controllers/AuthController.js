import { AuthService } from "../services/AuthService.js";

const DEFAULT_ERROR_MESSAGE = "An unexpected auth error occurred.";

function getRequestBody(request) {
  return request.body ?? {};
}

function getAuthContext(request) {
  return {
    body: getRequestBody(request),
    params: request.params ?? {},
    query: request.query ?? {},
    headers: request.headers ?? {},
    user: request.user ?? null,
  };
}

function buildAuthPayload(request) {
  const context = getAuthContext(request);
  return {
    ...context.body,
    params: context.params,
    query: context.query,
    headers: context.headers,
    user: context.user,
  };
}

function buildProfilePayload(request) {
  return {
    ...buildAuthPayload(request),
    userId: request.user?.id ?? request.user?.userId ?? null,
  };
}

function sendUnauthorized(response, message = "Unauthorized.") {
  return response.status(401).json({
    success: false,
    message,
  });
}

function sendSuccess(response, statusCode, message, data, extra = {}) {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });
}

function sendError(response, error) {
  const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
  const statusCode =
    error?.statusCode ??
    (message.includes("not found") ? 404 : message.includes("required") ? 400 : 500);

  return response.status(statusCode).json({
    success: false,
    message,
  });
}

function resolveAuthStatus(result, defaultStatusCode = 200) {
  if (result && typeof result === "object" && Number.isInteger(result.statusCode)) {
    return result.statusCode;
  }

  return defaultStatusCode;
}

function resolveAuthData(result) {
  if (result && typeof result === "object" && "data" in result) {
    return result.data;
  }

  return result;
}

function resolveAuthMessage(fallbackMessage, result) {
  if (result && typeof result === "object" && typeof result.message === "string") {
    return result.message;
  }

  return fallbackMessage;
}

async function runAuthAction(response, statusCode, message, action) {
  try {
    const result = await action();
    return sendSuccess(
      response,
      resolveAuthStatus(result, statusCode),
      resolveAuthMessage(message, result),
      resolveAuthData(result)
    );
  } catch (error) {
    return sendError(response, error);
  }
}

function getAuthMethod(methodName) {
  const method = AuthService[methodName];
  if (typeof method !== "function") {
    throw new Error(`AuthService.${methodName} is not available.`);
  }

  return method.bind(AuthService);
}

export const AuthController = {
  async register(request, response) {
    return runAuthAction(response, 201, "User registered.", () =>
      getAuthMethod("register")(buildAuthPayload(request))
    );
  },

  async login(request, response) {
    return runAuthAction(response, 200, "Login successful.", () =>
      getAuthMethod("login")(buildAuthPayload(request))
    );
  },

  async logout(request, response) {
    if (!request.user) {
      return sendUnauthorized(response);
    }

    return runAuthAction(response, 200, "Logout successful.", () =>
      getAuthMethod("logout")(buildAuthPayload(request))
    );
  },

  async getProfile(request, response) {
    if (!request.user) {
      return sendUnauthorized(response);
    }

    return runAuthAction(response, 200, "Profile retrieved.", () =>
      getAuthMethod("getProfile")(buildProfilePayload(request))
    );
  },

  async updateProfile(request, response) {
    if (!request.user) {
      return sendUnauthorized(response);
    }

    return runAuthAction(response, 200, "Profile updated.", () =>
      getAuthMethod("updateProfile")(buildProfilePayload(request))
    );
  },
};
