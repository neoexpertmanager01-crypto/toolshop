import pg from "pg";

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new pg.Pool({
    connectionString: connectionString || "postgresql://toolshop:toolshop@localhost:5432/toolshop",
  });
}
