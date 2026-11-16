import { randomUUID } from "node:crypto";

// X-Request-Id: береться з запиту клієнта або генерується; повертається в кожній відповіді
export function requestId(req, res, next) {
  const incoming = req.get("X-Request-Id");
  req.requestId = incoming && incoming.length <= 100 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

// Простий rate-limit у пам'яті: не більше max запитів за windowMs з однієї IP, далі 429 + Retry-After
export function rateLimit({ windowMs = 10_000, max = 30 } = {}) {
  const buckets = new Map(); // ip -> { count, start }
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || "local";
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { count: 0, start: now };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.start + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "TooManyRequests", code: "RATE_LIMITED", requestId: req.requestId });
    }
    next();
  };
}

// Режим штучних збоїв для демонстрації ретраїв і degraded mode (вмикається CHAOS=1):
// ~15% запитів затримуються на 1.2–2 с, ~20% завершуються 500/503
export function chaos({ enabled }) {
  return async (req, res, next) => {
    if (!enabled) return next();
    const r = Math.random();
    if (r < 0.15) await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));
    if (r > 0.8) {
      const unavailable = Math.random() < 0.5;
      return res
        .status(unavailable ? 503 : 500)
        .json({ error: unavailable ? "ServiceUnavailable" : "InternalError", code: "CHAOS", requestId: req.requestId });
    }
    next();
  };
}
