import { Router } from "express";

export function createOrdersRouter(orderService) {
  const router = Router();

  // Ідемпотентне створення: повтор з тим самим Idempotency-Key повертає те саме замовлення
  router.post("/", async (req, res) => {
    const { order, replayed } = await orderService.create(req.body, req.get("Idempotency-Key"));
    res.setHeader("Idempotent-Replayed", String(replayed));
    res.status(201).json({ ...order, requestId: req.requestId });
  });

  router.get("/:id", async (req, res) => {
    res.json(await orderService.get(req.params.id));
  });

  return router;
}
