import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createProductsRouter } from "./api/productsRouter.js";
import { createOrdersRouter } from "./api/ordersRouter.js";
import { chaos, rateLimit, requestId } from "./api/middleware.js";
import { errorHandler, notFoundHandler } from "./api/errorHandler.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

// Збирає Express-застосунок із готових сервісів (залежності передаються ззовні)
export function createApp({ productService, orderService, options = {} }) {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // API-маршрути: rate-limit і (за потреби) штучні збої
  const api = [rateLimit(options.rateLimit), chaos({ enabled: options.chaos })];
  app.use("/products", ...api, createProductsRouter(productService));
  app.use("/orders", ...api, createOrdersRouter(orderService));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
