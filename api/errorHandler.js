import { AppError } from "../service/errors.js";

// Перетворює будь-яку помилку в єдиний формат ErrorResponse: { error, code?, details?, requestId }
export function errorHandler(err, req, res, _next) {
  const requestId = req.requestId;
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.error,
      ...(err.code && { code: err.code }),
      ...(err.details && { details: err.details.map(({ field, message }) => ({ field, message })) }),
      requestId,
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "ValidationError", code: "INVALID_JSON", requestId });
  }
  console.error(`[${requestId}]`, err);
  res.status(500).json({ error: "InternalError", requestId });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "NotFound", code: "ROUTE_NOT_FOUND", requestId: req.requestId });
}
