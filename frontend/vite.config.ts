/**
 * Vite конфигурация
 * 
 * Настройки сборщика Vite для React приложения.
 * Включает настройки для development сервера, алиасы путей и production сборки.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Алиас @ для импорта из src директории
      // Пример: import Component from '@/components/Component'
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Принудительная оптимизация @mui/icons-material для корректной работы
    include: ['@mui/icons-material'],
  },
  server: {
    port: 5173, // Порт development сервера
    host: true, // Доступен на всех сетевых интерфейсах (для Docker)
  },
  build: {
    outDir: 'dist', // Директория для production сборки
    sourcemap: true, // Генерация source maps для отладки
  },
});

