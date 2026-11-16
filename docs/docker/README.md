# Практична 6: Docker

Виконано рівні **60** (Docker встановлено, hello-world) і **75** (контейнеризація власного застосунку).

## 60 балів — Docker і hello-world

Встановлено Docker Desktop 4.99 (Engine 29.9.3, WSL 2). Перевірка:

```bash
docker version
docker run hello-world
```

Результат — повідомлення «Hello from Docker!». Повний вивід: [01-hello-world.log](01-hello-world.log).

## 75 балів — контейнеризація API ToolShop

Файли в корені репозиторію:

- [`Dockerfile`](../../Dockerfile) — образ на `node:20-alpine`: спершу `npm ci --omit=dev` (окремий кешований шар),
  потім код; порт 8080, команда `node server.js`.
- [`.dockerignore`](../../.dockerignore) — не потрапляють в образ `node_modules`, `.env`, `.git`, `docs`, `test` тощо.

### Збирання образу

```bash
docker build -t toolshop-api:1.0.0 .
```

Образ `toolshop-api:1.0.0` (≈50 МБ вмісту). Лог: [02-build.log](02-build.log).

### Запуск контейнера

База даних працює в окремому контейнері `toolshop-db` (`npm run db:up`), тож API підключається до неї
через `host.docker.internal`:

```bash
docker run --name toolshop-api --rm -d -p 8080:8080 \
  -e DATABASE_URL=postgresql://toolshop:toolshop@host.docker.internal:5432/toolshop \
  toolshop-api:1.0.0
```

Застосунок доступний на **http://localhost:8080** (порт контейнера 8080 → порт хоста 8080).

Перевірка (лог: [03-run.log](03-run.log)):

```bash
docker ps --filter name=toolshop      # toolshop-api Up, 0.0.0.0:8080->8080/tcp
docker logs toolshop-api              # ToolShop API: http://localhost:8080
curl http://localhost:8080/health     # {"status":"ok"}
curl http://localhost:8080/products/1 # товар з бази даних
docker stop toolshop-api
```

Сторінка магазину, віддана контейнером, з даними з PostgreSQL:

![ToolShop у контейнері](04-app-in-container.png)
