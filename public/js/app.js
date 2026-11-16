import { fetchWithResilience, onHealthChange, readJson } from "./http.js";
import { getOrReuseKey, releaseKey } from "./idempotency.js";

const loadButton = document.getElementById("load");
const list = document.getElementById("items");
const status = document.getElementById("status");
const banner = document.getElementById("degraded");

const DEGRADED_AFTER = 3; // невдалих спроб поспіль
const DEGRADED_FOR_MS = 10_000;
let degradedUntil = 0;

function setStatus(text, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });
}

function errorText(err) {
  const rid = err.requestId ? ` (requestId: ${err.requestId})` : "";
  return `${err.message}${rid}`;
}

// Degraded mode: після кількох збоїв поспіль показуємо банер і тимчасово вимикаємо кнопки
onHealthChange((failures) => {
  if (failures >= DEGRADED_AFTER && Date.now() > degradedUntil) {
    degradedUntil = Date.now() + DEGRADED_FOR_MS;
    banner.hidden = false;
    setButtonsDisabled(true);
    setTimeout(() => {
      banner.hidden = true;
      setButtonsDisabled(false);
    }, DEGRADED_FOR_MS);
  }
});

function renderProducts(products) {
  list.innerHTML = "";
  for (const item of products) {
    const li = document.createElement("li");
    const id = document.createElement("div");
    id.className = "id";
    id.textContent = `Товар #${item.id}`;
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name;
    const price = document.createElement("div");
    price.className = "price";
    price.textContent = `${item.price.toLocaleString("uk-UA")} грн · на складі: ${item.stock}`;
    const buy = document.createElement("button");
    buy.className = "buy";
    buy.textContent = "Замовити";
    buy.disabled = item.stock === 0 || Date.now() < degradedUntil;
    buy.addEventListener("click", () => createOrder(item, buy));
    li.append(id, name, price, buy);
    list.appendChild(li);
  }
}

async function loadProducts() {
  loadButton.disabled = true;
  setStatus("Завантаження…");
  try {
    const products = await readJson(await fetchWithResilience("/products"));
    renderProducts(products);
    setStatus(products.length ? `Знайдено товарів: ${products.length}` : "Товарів немає");
  } catch (err) {
    setStatus(`Не вдалося завантажити: ${errorText(err)}`, true);
  } finally {
    loadButton.disabled = Date.now() < degradedUntil;
  }
}

async function createOrder(product, button) {
  const payload = { items: [{ productId: product.id, quantity: 1 }] };
  const { key, hash } = await getOrReuseKey(payload);
  button.disabled = true;
  setStatus(`Оформлюємо «${product.name}»…`);
  try {
    const res = await fetchWithResilience("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: key,
      retry: { retries: 3, baseDelayMs: 300, timeoutMs: 1000, jitter: true },
    });
    const order = await readJson(res);
    releaseKey(hash);
    await loadProducts();
    setStatus(`Замовлення #${order.id} на ${order.total.toLocaleString("uk-UA")} грн створено (requestId: ${order.requestId})`);
  } catch (err) {
    // 4xx — остаточна відповідь, ключ звільняємо; при збоях сервера ключ лишається для наступної спроби
    if (err.status && err.status < 500 && err.status !== 429) releaseKey(hash);
    setStatus(`Замовлення не створено: ${errorText(err)}`, true);
    button.disabled = Date.now() < degradedUntil;
  }
}

loadButton.addEventListener("click", loadProducts);
