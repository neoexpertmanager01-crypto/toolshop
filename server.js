import { createApp } from "./app.js";
import { createPool } from "./infrastructure/db.js";
import { createPgProductRepository } from "./infrastructure/productRepository.js";
import { createProductService } from "./service/productService.js";

const PORT = Number(process.env.PORT) || 8080;

const pool = createPool();
const productService = createProductService(createPgProductRepository(pool));
const app = createApp({ productService });

app.listen(PORT, () => console.log(`ToolShop API: http://localhost:${PORT}`));
