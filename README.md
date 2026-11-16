# ToolShop

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

![Swagger Editor](docs/api/swagger_screenshot.png)

## Робота в команді

Лідер тримає основний репозиторій. Учасники роблять fork, працюють в окремих гілках
і відкривають pull request у основний репозиторій.
