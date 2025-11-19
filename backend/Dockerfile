# Multi-stage build для оптимизации размера образа
# Stage 1: Builder - сборка приложения
FROM node:20-alpine AS builder

# Установка зависимостей для Prisma (OpenSSL требуется для работы Prisma в Alpine)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Копирование package.json и prisma схемы для кэширования слоя зависимостей
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Копирование исходного кода
COPY . .

# Переменные окружения для обхода проблем с Prisma бинарниками (Cloudflare/CDN)
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh

# Генерация Prisma Client с retry логикой (до 10 попыток с задержкой 30 сек)
# Это необходимо из-за возможных проблем с доступностью CDN Prisma
RUN apk add --no-cache curl && \
    for i in 1 2 3 4 5 6 7 8 9 10; do \
      echo "Attempt $i to generate Prisma client..." && \
      npx prisma generate && break || \
      (echo "Failed, waiting 30 seconds before retry..." && sleep 30); \
    done

# Компиляция TypeScript
RUN npm run build

# Stage 2: Production - минимальный production образ
FROM node:20-alpine AS production

# Установка OpenSSL для Prisma в production
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Установка только production зависимостей
COPY package*.json ./
RUN npm install --omit=dev

# Копирование собранного приложения и Prisma клиента из builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Создание директории для логов
RUN mkdir -p logs

EXPOSE 3000

# Запуск приложения
CMD ["npm", "start"]

