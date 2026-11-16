import { createHash } from "node:crypto";
import { Product } from "../domain/catalog/Product.js";
import { Order } from "../domain/ordering/Order.js";
import { ConflictError, NotFoundError, UnprocessableError, ValidationError } from "./errors.js";

const MAX_QTY = 100;

// Перевіряє тіло POST /orders і зводить однакові товари в одну позицію: Map(productId → quantity)
function validate(input) {
  const details = [];
  const add = (field, code, message) => details.push({ field, code, message });
  const lines = new Map();

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    add("body", "BODY_INVALID", "Body must be a JSON object");
    return { details, lines };
  }
  if (input.customerId !== undefined && (typeof input.customerId !== "string" || !input.customerId.trim())) {
    add("customerId", "CUSTOMER_INVALID", "customerId must be a non-empty string");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    add("items", "ITEMS_REQUIRED", "At least one item is required");
    return { details, lines };
  }
  input.items.forEach((item, i) => {
    const productId = item?.productId;
    const quantity = item?.quantity ?? 1;
    if (!Number.isInteger(productId) || productId <= 0) {
      add(`items[${i}].productId`, "PRODUCT_ID_INVALID", "productId must be a positive integer");
    } else if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QTY) {
      add(`items[${i}].quantity`, "QUANTITY_INVALID", `quantity must be an integer from 1 to ${MAX_QTY}`);
    } else {
      lines.set(productId, (lines.get(productId) ?? 0) + quantity);
    }
  });
  return { details, lines };
}

// Відбиток запиту: той самий ключ з іншим тілом — помилка клієнта
function hashRequest(customerId, lines) {
  const canonical = JSON.stringify({ customerId, lines: [...lines].sort(([a], [b]) => a - b) });
  return createHash("sha256").update(canonical).digest("hex");
}

function toResponse(order) {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    total: order.total,
    items: order.items,
    createdAt: new Date(order.createdAt).toISOString(),
  };
}

export function createOrderService(repository) {
  return {
    /**
     * Ідемпотентне створення замовлення.
     * Повертає { order, replayed }: replayed = true, якщо замовлення з цим ключем уже існувало.
     */
    async create(input, idempotencyKey) {
      if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
        throw new ValidationError([
          { field: "Idempotency-Key", code: "IDEMPOTENCY_KEY_REQUIRED", message: "Header Idempotency-Key (8–200 chars) is required" },
        ]);
      }
      const { details, lines } = validate(input);
      if (details.length) throw new ValidationError(details);

      const customerId = input.customerId?.trim() || "guest";
      const requestHash = hashRequest(customerId, lines);

      const createdId = await repository.transaction(async (tx) => {
        if (!(await tx.claimIdempotencyKey(idempotencyKey, requestHash))) return null;

        const records = await tx.lockProducts([...lines.keys()]);
        const missing = [...lines.keys()].filter((id) => !records.some((r) => r.id === id));
        if (missing.length) throw new NotFoundError("PRODUCT_NOT_FOUND");

        const order = new Order({ customerId });
        for (const record of records) {
          const product = new Product(record);
          const quantity = lines.get(product.id);
          if (!product.isAvailable(quantity)) {
            throw new ConflictError("INSUFFICIENT_STOCK", [
              { field: `product:${product.id}`, message: `Only ${product.stock} of «${product.name}» left` },
            ]);
          }
          product.reserve(quantity);
          await tx.saveProductStock(product.id, product.stock);
          order.addItem(product, quantity);
        }
        const orderId = await tx.insertOrder(order);
        await tx.attachOrderToKey(idempotencyKey, orderId);
        return orderId;
      });

      if (createdId !== null) {
        return { order: toResponse(await repository.findOrderById(createdId)), replayed: false };
      }
      const existing = await repository.findIdempotencyKey(idempotencyKey);
      if (!existing || existing.requestHash !== requestHash) {
        throw new UnprocessableError("IDEMPOTENCY_KEY_REUSED");
      }
      return { order: toResponse(await repository.findOrderById(existing.orderId)), replayed: true };
    },

    async get(id) {
      const n = Number(id);
      const order = Number.isInteger(n) && n > 0 ? await repository.findOrderById(n) : null;
      if (!order) throw new NotFoundError("ORDER_NOT_FOUND");
      return toResponse(order);
    },
  };
}
