# 1. Середовище: Node.js 20 на легкому Alpine Linux
FROM node:20-alpine
WORKDIR /app

# 2. Залежності (окремим шаром — кешуються, поки не змінився package*.json)
COPY package*.json ./
RUN npm ci --omit=dev

# 3. Код застосунку
COPY . .

# Сервер слухає порт 8080; адреса БД задається змінною DATABASE_URL при запуску
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
