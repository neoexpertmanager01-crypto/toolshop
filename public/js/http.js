// HTTP-хелпер: таймаут через AbortController, ретраї з експоненційним backoff і джитером,
// очікування Retry-After на 429, X-Request-Id та Idempotency-Key у заголовках.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (base, attempt, jitter) => base * 2 ** attempt + (jitter ? Math.floor(Math.random() * 100) : 0);

// Стан «здоров'я» сервера для degraded mode: рахуємо невдалі спроби поспіль
const listeners = new Set();
let consecutiveFailures = 0;
export function onHealthChange(fn) { listeners.add(fn); }
function report(ok) {
  consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
  listeners.forEach((fn) => fn(consecutiveFailures));
}

export class HttpError extends Error {
  constructor(message, { status, body, requestId } = {}) {
    super(message);
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

/**
 * @param {string} url
 * @param {RequestInit & { idempotencyKey?: string, retry?: { retries?: number, baseDelayMs?: number, timeoutMs?: number, jitter?: boolean } }} opts
 * @returns {Promise<Response>} остання відповідь (2xx або 4xx, яку не варто повторювати)
 */
export async function fetchWithResilience(url, opts = {}) {
  const { retry = {}, idempotencyKey, ...init } = opts;
  const { retries = 3, baseDelayMs = 300, timeoutMs = 1000, jitter = true } = retry;
  const requestId = crypto.randomUUID(); // один id на всі спроби — їх видно разом у логах

  for (let attempt = 0; ; attempt++) {
    const headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-Id", requestId);
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { ...init, headers, signal: controller.signal });
    } catch (err) {
      // мережевий збій або таймаут (AbortError)
      report(false);
      const reason = err.name === "AbortError" ? `таймаут ${timeoutMs} мс` : "мережевий збій";
      if (attempt >= retries) throw new HttpError(`Сервер не відповідає (${reason})`, { requestId });
      await sleep(backoff(baseDelayMs, attempt, jitter));
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      report(false);
      if (attempt >= retries) return res;
      const retryAfter = Number(res.headers.get("Retry-After")) || 1;
      await sleep(retryAfter * 1000);
      continue;
    }
    if (res.status >= 500) {
      report(false);
      if (attempt >= retries) return res;
      await sleep(backoff(baseDelayMs, attempt, jitter));
      continue;
    }
    report(true);
    return res;
  }
}

// Читає JSON; для статусів ≥ 400 кидає HttpError з тілом ErrorResponse
export async function readJson(res) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const requestId = body?.requestId ?? res.headers.get("X-Request-Id");
    throw new HttpError(body?.code || body?.error || `HTTP ${res.status}`, { status: res.status, body, requestId });
  }
  return body;
}
