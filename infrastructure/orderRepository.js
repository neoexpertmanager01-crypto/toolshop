// Доступ до таблиць orders, order_items, idempotency_keys.
// Створення замовлення виконується в одній транзакції разом із резервуванням товару й записом ключа.

function toProductRecord(row) {
  return { id: row.id, name: row.name, categoryId: row.category_id, price: Number(row.price), stock: row.stock };
}

function txApi(client) {
  return {
    // true — ключ новий і тепер належить цій транзакції; false — ключ уже використано.
    // Якщо паралельна транзакція вставила той самий ключ, INSERT чекає її завершення.
    async claimIdempotencyKey(key, requestHash) {
      const { rowCount } = await client.query(
        "INSERT INTO idempotency_keys (key, request_hash) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [key, requestHash]
      );
      return rowCount === 1;
    },

    async lockProducts(ids) {
      const { rows } = await client.query(
        "SELECT id, name, category_id, price, stock FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
        [ids]
      );
      return rows.map(toProductRecord);
    },

    async saveProductStock(id, stock) {
      await client.query("UPDATE products SET stock = $2, updated_at = now() WHERE id = $1", [id, stock]);
    },

    async insertOrder(order) {
      const { rows } = await client.query(
        "INSERT INTO orders (customer_id, status, total) VALUES ($1, $2, $3) RETURNING id",
        [order.customerId, order.status, order.total]
      );
      const orderId = rows[0].id;
      for (const item of order.items) {
        await client.query(
          "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)",
          [orderId, item.productId, item.productName, item.unitPrice, item.quantity]
        );
      }
      return orderId;
    },

    async attachOrderToKey(key, orderId) {
      await client.query("UPDATE idempotency_keys SET order_id = $2 WHERE key = $1", [key, orderId]);
    },
  };
}

export function createPgOrderRepository(pool) {
  return {
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(txApi(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async findIdempotencyKey(key) {
      const { rows } = await pool.query("SELECT request_hash, order_id FROM idempotency_keys WHERE key = $1", [key]);
      return rows[0] ? { requestHash: rows[0].request_hash, orderId: rows[0].order_id } : null;
    },

    async findOrderById(id) {
      const { rows } = await pool.query("SELECT id, customer_id, status, total, created_at FROM orders WHERE id = $1", [id]);
      if (!rows[0]) return null;
      const items = await pool.query(
        "SELECT product_id, product_name, unit_price, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id",
        [id]
      );
      const o = rows[0];
      return {
        id: o.id,
        customerId: o.customer_id,
        status: o.status,
        total: Number(o.total),
        createdAt: o.created_at,
        items: items.rows.map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          unitPrice: Number(i.unit_price),
          quantity: i.quantity,
        })),
      };
    },
  };
}
