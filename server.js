import { createApp } from "./app.js";
import { createPool } from "./infrastructure/db.js";
import { createPgProductRepository } from "./infrastructure/productRepository.js";
import { createPgOrderRepository } from "./infrastructure/orderRepository.js";
import { createProductService } from "./service/productService.js";
import { createOrderService } from "./service/orderService.js";

const PORT = Number(process.env.PORT) || 8080;

const pool = createPool();
const app = createApp({
  productService: createProductService(createPgProductRepository(pool)),
  orderService: createOrderService(createPgOrderRepository(pool)),
  options: {
    chaos: process.env.CHAOS === "1",
    rateLimit: {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 10_000,
      max: Number(process.env.RATE_LIMIT_MAX) || 30,
    },
  },
});

app.listen(PORT, () => {
  console.log(`ToolShop API: http://localhost:${PORT}${process.env.CHAOS === "1" ? " (CHAOS mode)" : ""}`);
});
