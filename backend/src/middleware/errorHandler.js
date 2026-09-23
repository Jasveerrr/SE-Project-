export function notFoundHandler(_request, response) {
  response.status(404).json({ success: false, message: "Route not found" });
}

export function errorHandler(error, _request, response, _next) {
  const status = error.statusCode ?? 500;
  response.status(status).json({
    success: false,
    message: status >= 500 ? "Internal Server Error" : (error.message ?? "Request failed"),
    ...(Array.isArray(error.errors) && error.errors.length ? { errors: error.errors } : {}),
  });
}
