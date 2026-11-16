import { test } from "node:test";
import assert from "node:assert/strict";
import { createProductService } from "../service/productService.js";
import { NotFoundError, ValidationError } from "../service/errors.js";

// Репозиторій у пам'яті замість PostgreSQL — тестуємо лише логіку service/
function createInMemoryRepository() {
  const rows = new Map();
  let nextId = 1;
  return {
    async findAll() { return [...rows.values()]; },
    async findById(id) { return rows.get(id) ?? null; },
    async create(data) {
      const now = new Date();
      const row = { id: nextId++, name: data.name, categoryId: data.categoryId, price: data.price, stock: data.stock, createdAt: now, updatedAt: now };
      rows.set(row.id, row);
      return row;
    },
    async update(id, data) {
      const row = { ...rows.get(id), name: data.name, categoryId: data.categoryId, price: data.price, stock: data.stock, updatedAt: new Date() };
      rows.set(id, row);
      return row;
    },
    async delete(id) { return rows.delete(id); },
  };
}

test("create: коректні дані → товар зі статусом за контрактом", async () => {
  const service = createProductService(createInMemoryRepository());

  const product = await service.create({ name: "  Фрезер 1200 Вт ", price: 3500, stock: 5 });

  assert.equal(product.id, 1);
  assert.equal(product.name, "Фрезер 1200 Вт");
  assert.equal(product.price, 3500);
  assert.equal(product.stock, 5);
  assert.equal(product.categoryId, null);
  assert.match(product.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("create: без назви → ValidationError з кодом NAME_REQUIRED", async () => {
  const service = createProductService(createInMemoryRepository());

  await assert.rejects(
    () => service.create({ price: 3500 }),
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.status, 400);
      assert.equal(err.code, "NAME_REQUIRED");
      assert.deepEqual(err.details.map((d) => d.field), ["name"]);
      return true;
    }
  );
});

test("update: змінює лише передані поля", async () => {
  const service = createProductService(createInMemoryRepository());
  const created = await service.create({ name: "Пила", price: 4200, stock: 3 });

  const updated = await service.update(created.id, { price: 3900 });

  assert.equal(updated.price, 3900);
  assert.equal(updated.name, "Пила");
  assert.equal(updated.stock, 3);
});

test("get: неіснуючий id → NotFoundError", async () => {
  const service = createProductService(createInMemoryRepository());

  await assert.rejects(() => service.get(999), NotFoundError);
});
