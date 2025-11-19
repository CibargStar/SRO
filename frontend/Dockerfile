# Production Dockerfile для frontend
# Собирает React приложение с Vite и запускает preview сервер

FROM node:20-alpine

WORKDIR /app

# Копирование package.json для кэширования слоя зависимостей
COPY package*.json ./
RUN npm install

# Копирование исходного кода и сборка
COPY . .
RUN npm run build

EXPOSE 5173

# Запуск preview сервера для production
CMD ["npm", "run", "preview"]

