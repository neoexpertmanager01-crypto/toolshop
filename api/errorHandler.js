import { AppError } from "../service/errors.js";

// Перетворює будь-яку помилку в єдиний формат ErrorResponse
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.error,
      ...(err.code && { code: err.code }),
      ...(err.details && { details: err.details.map(({ field, message }) => ({ field, message })) }),
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "ValidationError", code: "INVALID_JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "InternalError" });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "NotFound", code: "ROUTE_NOT_FOUND" });
}
