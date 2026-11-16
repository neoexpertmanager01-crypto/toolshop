import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createProductsRouter } from "./api/productsRouter.js";
import { errorHandler, notFoundHandler } from "./api/errorHandler.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

// Збирає Express-застосунок із готових сервісів (залежності передаються ззовні)
export function createApp({ productService }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/products", createProductsRouter(productService));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
