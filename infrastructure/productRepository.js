// Доступ до таблиці products. Єдине місце, де є SQL для товарів.
const COLUMNS = "id, name, category_id, price, stock, created_at, updated_at";

function toRecord(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    price: Number(row.price),
    stock: row.stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPgProductRepository(pool) {
  return {
    async findAll() {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM products ORDER BY id`);
      return rows.map(toRecord);
    },

    async findById(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async create({ name, categoryId, price, stock }) {
      const { rows } = await pool.query(
        `INSERT INTO products (name, category_id, price, stock) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
        [name, categoryId, price, stock]
      );
      return toRecord(rows[0]);
    },

    async update(id, { name, categoryId, price, stock }) {
      const { rows } = await pool.query(
        `UPDATE products SET name = $2, category_id = $3, price = $4, stock = $5, updated_at = now()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, name, categoryId, price, stock]
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async delete(id) {
      const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [id]);
      return rowCount > 0;
    },
  };
}
