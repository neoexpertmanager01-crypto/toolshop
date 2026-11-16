import { Product } from "../domain/catalog/Product.js";
import { NotFoundError, ValidationError } from "./errors.js";

const FIELDS = ["name", "categoryId", "price", "stock"];

// Перевіряє DTO запиту. partial = true для PATCH (усі поля необов'язкові, але хоча б одне потрібне).
function validate(input, { partial }) {
  const details = [];
  const add = (field, code, message) => details.push({ field, code, message });

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    add("body", "BODY_INVALID", "Body must be a JSON object");
    return details;
  }
  for (const key of Object.keys(input)) {
    if (!FIELDS.includes(key)) add(key, "UNKNOWN_FIELD", `Unknown field: ${key}`);
  }
  if (partial && !FIELDS.some((f) => f in input)) {
    add("body", "EMPTY_UPDATE", "At least one field is required");
  }

  if (!partial || "name" in input) {
    const { name } = input;
    if (typeof name !== "string" || name.trim() === "") add("name", "NAME_REQUIRED", "Name is required");
    else if (name.length > 200) add("name", "NAME_TOO_LONG", "Name must be at most 200 characters");
  }
  if (!partial || "price" in input) {
    if (typeof input.price !== "number" || !(input.price > 0)) {
      add("price", "PRICE_INVALID", "Price must be a number greater than 0");
    }
  }
  if ("stock" in input && (!Number.isInteger(input.stock) || input.stock < 0)) {
    add("stock", "STOCK_INVALID", "Stock must be an integer ≥ 0");
  }
  if ("categoryId" in input && input.categoryId !== null && typeof input.categoryId !== "string") {
    add("categoryId", "CATEGORY_INVALID", "categoryId must be a string or null");
  }
  return details;
}

// Запис репозиторію → DTO відповіді за контрактом ProductResponse
function toResponse(record) {
  return {
    id: record.id,
    name: record.name,
    categoryId: record.categoryId ?? null,
    price: record.price,
    stock: record.stock,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

function parseId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function createProductService(repository) {
  async function findOrThrow(id) {
    const parsed = parseId(id);
    const record = parsed && (await repository.findById(parsed));
    if (!record) throw new NotFoundError("PRODUCT_NOT_FOUND");
    return record;
  }

  return {
    async list() {
      return (await repository.findAll()).map(toResponse);
    },

    async get(id) {
      return toResponse(await findOrThrow(id));
    },

    async create(input) {
      const details = validate(input, { partial: false });
      if (details.length) throw new ValidationError(details);
      // доменна модель перевіряє інваріанти товару
      const product = new Product({
        name: input.name.trim(),
        categoryId: input.categoryId ?? null,
        price: input.price,
        stock: input.stock ?? 0,
      });
      return toResponse(await repository.create(product));
    },

    async update(id, input) {
      const existing = await findOrThrow(id);
      const details = validate(input, { partial: true });
      if (details.length) throw new ValidationError(details);
      const product = new Product({
        ...existing,
        ...input,
        name: (input.name ?? existing.name).trim(),
      });
      return toResponse(await repository.update(existing.id, product));
    },

    async remove(id) {
      const parsed = parseId(id);
      if (!parsed || !(await repository.delete(parsed))) throw new NotFoundError("PRODUCT_NOT_FOUND");
    },
  };
}
