export function notFoundHandler(_request, response) {
  response.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, _request, response, _next) {
  const status = error.statusCode ?? 500;
  response.status(status).json({ message: error.message ?? "Internal Server Error" });
}
