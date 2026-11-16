# ToolShop

[![CI](https://github.com/neoexpertmanager01-crypto/toolshop/actions/workflows/ci.yml/badge.svg)](https://github.com/neoexpertmanager01-crypto/toolshop/actions/workflows/ci.yml)

Міні-магазин інструментів (верстати, електроінструмент). Командний курсовий проєкт з Web design.

Архітектура: **клієнт (HTML) → бекенд (Node.js + Express, модульний моноліт) → БД (PostgreSQL у Docker)**.
Документація — у [docs/](docs): бізнес-документ, діаграма архітектури, домен (DDD), ADR, контракт API.

## Вимоги

- Node.js 20+
- Docker Desktop

## Запуск

```bash
npm install
npm run db:up      # запускає Postgres у Docker і створює таблицю products з тестовими даними
npm start          # API і сторінка на http://localhost:8080
```

Відкрити http://localhost:8080 і натиснути **Load items**.

Зупинити базу: `npm run db:down` (дані зберігаються у volume `db-data`).

## Запуск у Docker

```bash
npm run db:up                                   # PostgreSQL у контейнері toolshop-db
docker build -t toolshop-api:1.0.0 .            # образ API
docker run --name toolshop-api --rm -d -p 8080:8080 \
  -e DATABASE_URL=postgresql://toolshop:toolshop@host.docker.internal:5432/toolshop \
  toolshop-api:1.0.0                            # http://localhost:8080
docker stop toolshop-api
```

Звіт практичної 6 (hello-world, збирання, запуск, логи): [docs/docker/README.md](docs/docker/README.md).

## CI/CD (GitHub Actions)

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml) · запуски: [Actions](https://github.com/neoexpertmanager01-crypto/toolshop/actions/workflows/ci.yml)

| Job | Коли | Що робить |
|-----|------|-----------|
| **Install & test** | `push` і `pull_request` у `main` | checkout → Node 20 з кешем npm → `npm ci` → перевірка синтаксису → `npm test`; JUnit-звіт `test-results.xml` завантажується як артефакт `test-results` |
| **Build & push image to GHCR** | лише `push` у `main` (після успішних тестів) | збирає Docker-образ API з [Dockerfile](Dockerfile) і публікує в GitHub Container Registry |

**Delivery — варіант A (GHCR).** Образ:
[`ghcr.io/neoexpertmanager01-crypto/toolshop-api`](https://github.com/neoexpertmanager01-crypto/toolshop/pkgs/container/toolshop-api)
з тегами `sha-<commit>` (відстеження конкретної збірки) і `latest`.

```bash
docker pull ghcr.io/neoexpertmanager01-crypto/toolshop-api:latest
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgresql://toolshop:toolshop@host.docker.internal:5432/toolshop \
  ghcr.io/neoexpertmanager01-crypto/toolshop-api:latest
```

Додатково: мінімальні `permissions` (`contents: read`, `packages: write` лише для delivery), `concurrency`
зі скасуванням застарілих запусків, `timeout-minutes`, кеш npm і Docker-шарів, Job Summary з тегами образу.

## Тести

```bash
npm test           # юніт-тести рівня service/ (node:test, без бази даних)
```

## Структура коду

| Папка | Шар |
|-------|-----|
| `api/` | HTTP-роути та єдиний обробник помилок |
| `service/` | use-cases: валідація, бізнес-операції, мапінг DTO ↔ domain |
| `domain/` | сутності за bounded contexts (`catalog/`, `ordering/`, `payment/`, `delivery/`, `identity/`) |
| `infrastructure/` | доступ до PostgreSQL (репозиторії) |

Правила шарів — у [ADR 0002](docs/adr/0002-layered-architecture.md).

## API документація

Контракт API: [docs/api/openapi.yaml](docs/api/openapi.yaml) (OpenAPI 3.0, перевірено в
[Swagger Editor](https://editor.swagger.io/)). Стиль API та формат помилок — [ADR 0003](docs/adr/0003-api-style-and-error-model.md).

| Метод | Шлях | Відповіді |
|-------|------|-----------|
| GET | `/health` | 200 `{ "status": "ok" }` |
| GET | `/products` | 200 — список товарів |
| POST | `/products` | 201, 400 |
| GET | `/products/{id}` | 200, 404 |
| PATCH | `/products/{id}` | 200, 400, 404 |
| DELETE | `/products/{id}` | 204, 404 |
| POST | `/orders` (заголовок `Idempotency-Key`) | 201, 400, 404, 409, 422, 429 |
| GET | `/orders/{id}` | 200, 404 |

![Swagger Editor](docs/api/swagger_screenshot.png)

## Обробка помилок і стійкість

| Механізм | Де | Як працює |
|----------|----|-----------|
| Ідемпотентність | `POST /orders`, `service/orderService.js` | Ключ `Idempotency-Key` фіксується в таблиці `idempotency_keys` в одній транзакції із замовленням. Повтор з тим самим ключем повертає те саме замовлення (`Idempotent-Replayed: true`) без повторного списання залишку; той самий ключ з іншим тілом — `422`. |
| Кореляція | `api/middleware.js` | Кожна відповідь має `X-Request-Id` (з запиту клієнта або згенерований), у тілі помилки — `requestId`. |
| Єдиний формат помилки | `api/errorHandler.js` | `{ error, code?, details?, requestId }` |
| Rate-limit | `api/middleware.js` | Понад 30 запитів за 10 с з однієї IP → `429` + `Retry-After`. |
| Таймаут клієнта | `public/js/http.js` | `AbortController` скасовує запит, довший за 1 с. |
| Ретраї | `public/js/http.js` | До 3 повторів на 5xx, таймаут і мережеві збої: експоненційний backoff (300 → 600 → 1200 мс) + джитер; на `429` — очікування `Retry-After`. |
| Degraded mode | `public/js/app.js` | Після 3 невдалих спроб поспіль — банер «Сервер перевантажено» і вимкнені кнопки на 10 с. |
| Health-check | `GET /health` | `{ "status": "ok" }` |

### Демонстрація

Режим штучних збоїв (≈15 % запитів затримуються на 1.2–2 с, ≈20 % отримують 500/503):

```bash
CHAOS=1 npm start
```

Перевірка ідемпотентності без фронтенду:

```bash
IDEM=$(uuidgen)
curl -i -X POST localhost:8080/orders -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM" -H "X-Request-Id: demo-1" -d '{"items":[{"productId":1,"quantity":1}]}'
# повтор тим самим ключем → той самий id, заголовок Idempotent-Replayed: true
curl -i -X POST localhost:8080/orders -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM" -H "X-Request-Id: demo-2" -d '{"items":[{"productId":1,"quantity":1}]}'
```

## Робота в команді

Лідер тримає основний репозиторій. Учасники роблять fork, працюють в окремих гілках
і відкривають pull request у основний репозиторій.
