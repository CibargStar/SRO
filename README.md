# BM Tools

Проект на основе современного стека технологий.

## Структура проекта

- `backend/` - Backend приложение (Node.js + Express + TypeScript)
- `frontend/` - Frontend приложение (React + Vite + TypeScript)

## Установка

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Запуск

### Development
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### Docker

#### Production
```bash
docker-compose up --build
```

#### Development (с hot reload)
```bash
docker-compose -f docker-compose.dev.yml up --build
```

#### Остановка
```bash
docker-compose down
# или для dev
docker-compose -f docker-compose.dev.yml down
```

#### Пересборка
```bash
docker-compose build --no-cache
```

