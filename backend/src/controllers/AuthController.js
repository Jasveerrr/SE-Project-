import { AuthService } from "../services/AuthService.js";

function getRequestBody(request) {
  return request.body ?? {};
}

function buildAuthenticatedPayload(request) {
  return {
    ...getRequestBody(request),
    userId: request.user?.id ?? request.user?.userId ?? null,
    user: request.user ?? null,
  };
}

function sendSuccess(response, result) {
  return response.status(result.statusCode).json({
    success: true,
    message: result.message,
    data: result.data,
  });
}

async function runAuthAction(response, next, action) {
  try {
    const result = await action();
    return sendSuccess(response, result);
  } catch (error) {
    return next(error);
  }
}

export const AuthController = {
  async register(request, response, next) {
    return runAuthAction(response, next, () => AuthService.register(getRequestBody(request)));
  },

  async login(request, response, next) {
    return runAuthAction(response, next, () => AuthService.login(getRequestBody(request)));
  },

  async logout(request, response, next) {
    return runAuthAction(response, next, () =>
      AuthService.logout(buildAuthenticatedPayload(request))
    );
  },

  async getProfile(request, response, next) {
    return runAuthAction(response, next, () =>
      AuthService.getProfile(buildAuthenticatedPayload(request))
    );
  },

  async updateProfile(request, response, next) {
    return runAuthAction(response, next, () =>
      AuthService.updateProfile(buildAuthenticatedPayload(request))
    );
  },
};
