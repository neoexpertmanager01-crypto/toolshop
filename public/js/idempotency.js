// Ключ ідемпотентності на основі хешу тіла запиту.
// Поки запит не завершився остаточно, повторні натискання / ретраї використовують той самий ключ.

const pending = new Map(); // hash -> Promise<key> (захист від подвійного кліку в межах вкладки)

async function payloadHash(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* приватний режим */ } }
function storageDel(k) { try { localStorage.removeItem(k); } catch { /* приватний режим */ } }

export async function getOrReuseKey(payload) {
  const hash = await payloadHash(payload);
  if (!pending.has(hash)) {
    const key = storageGet(`idem:${hash}`) ?? crypto.randomUUID();
    storageSet(`idem:${hash}`, key);
    pending.set(hash, key);
  }
  return { key: pending.get(hash), hash };
}

// Після остаточної відповіді (успіх або помилка клієнта) ключ звільняється:
// наступне таке саме замовлення буде новим, а не повтором старого.
export function releaseKey(hash) {
  pending.delete(hash);
  storageDel(`idem:${hash}`);
}
