-- Виконується автоматично при першому запуску контейнера Postgres (порожній volume)
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT          NOT NULL,
  category_id TEXT,
  price       NUMERIC(10,2) NOT NULL CHECK (price > 0),
  stock       INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO products (name, category_id, price, stock)
SELECT * FROM (VALUES
  ('Фрезер ручний 1200 Вт',           'routers',      3500.00, 5),
  ('Циркулярна пила 1800 Вт',         'saws',         4200.00, 3),
  ('Шуруповерт акумуляторний 18 В',   'screwdrivers', 2200.00, 12),
  ('Рейсмусовий верстат 305 мм',      'machines',     18900.00, 1),
  ('Шліфмашина ексцентрикова 125 мм', 'sanders',      2700.00, 7)
) AS seed(name, category_id, price, stock)
WHERE NOT EXISTS (SELECT 1 FROM products);
