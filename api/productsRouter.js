import { Router } from "express";

// Контролери лише приймають HTTP-запит, передають DTO в service/ і повертають відповідь за контрактом.
export function createProductsRouter(productService) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await productService.list());
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await productService.create(req.body));
  });

  router.get("/:id", async (req, res) => {
    res.json(await productService.get(req.params.id));
  });

  router.patch("/:id", async (req, res) => {
    res.json(await productService.update(req.params.id, req.body));
  });

  router.delete("/:id", async (req, res) => {
    await productService.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}
