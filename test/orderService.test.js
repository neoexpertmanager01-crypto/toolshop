import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderService } from "../service/orderService.js";
import { ConflictError, UnprocessableError, ValidationError } from "../service/errors.js";

// Репозиторій у пам'яті з «транзакцією»: при помилці стан відкочується
function createInMemoryRepository(products) {
  let state = { products: structuredClone(products), orders: new Map(), keys: new Map(), nextId: 1 };
  return {
    state: () => state,
    async transaction(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn({
          async claimIdempotencyKey(key, requestHash) {
            if (state.keys.has(key)) return false;
            state.keys.set(key, { requestHash, orderId: null });
            return true;
          },
          async lockProducts(ids) { return state.products.filter((p) => ids.includes(p.id)).map((p) => ({ ...p })); },
          async saveProductStock(id, stock) { state.products.find((p) => p.id === id).stock = stock; },
          async insertOrder(order) {
            const id = state.nextId++;
            state.orders.set(id, { id, customerId: order.customerId, status: order.status, total: order.total, items: order.items.map((i) => ({ ...i })), createdAt: new Date() });
            return id;
          },
          async attachOrderToKey(key, orderId) { state.keys.get(key).orderId = orderId; },
        });
      } catch (err) {
        state = snapshot;
        throw err;
      }
    },
    async findIdempotencyKey(key) { return state.keys.get(key) ?? null; },
    async findOrderById(id) { return state.orders.get(id) ?? null; },
  };
}

const PRODUCTS = [
  { id: 1, name: "Фрезер", categoryId: "routers", price: 3500, stock: 5 },
  { id: 2, name: "Пила", categoryId: "saws", price: 4200, stock: 1 },
];
const KEY = "test-key-0001";

test("повтор POST з тим самим Idempotency-Key повертає те саме замовлення без дубля", async () => {
  const repo = createInMemoryRepository(PRODUCTS);
  const service = createOrderService(repo);
  const body = { items: [{ productId: 1, quantity: 2 }] };

  const first = await service.create(body, KEY);
  const second = await service.create(body, KEY);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.order.id, first.order.id);
  assert.equal(first.order.total, 7000);
  assert.equal(repo.state().orders.size, 1);
  assert.equal(repo.state().products[0].stock, 3); // зарезервовано лише один раз
});

test("той самий ключ з іншим тілом → 422 IDEMPOTENCY_KEY_REUSED", async () => {
  const service = createOrderService(createInMemoryRepository(PRODUCTS));
  await service.create({ items: [{ productId: 1 }] }, KEY);

  await assert.rejects(() => service.create({ items: [{ productId: 2 }] }, KEY), UnprocessableError);
});

test("без Idempotency-Key → ValidationError", async () => {
  const service = createOrderService(createInMemoryRepository(PRODUCTS));

  await assert.rejects(
    () => service.create({ items: [{ productId: 1 }] }, undefined),
    (err) => err instanceof ValidationError && err.code === "IDEMPOTENCY_KEY_REQUIRED"
  );
});

test("нестача товару → 409, ключ звільняється для повторної спроби", async () => {
  const repo = createInMemoryRepository(PRODUCTS);
  const service = createOrderService(repo);

  await assert.rejects(() => service.create({ items: [{ productId: 2, quantity: 3 }] }, KEY), ConflictError);
  assert.equal(repo.state().keys.size, 0);
  assert.equal(repo.state().products[1].stock, 1);

  const ok = await service.create({ items: [{ productId: 2, quantity: 1 }] }, KEY);
  assert.equal(ok.replayed, false);
});
