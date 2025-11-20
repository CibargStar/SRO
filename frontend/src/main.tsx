/**
 * Точка входа React приложения
 * 
 * Инициализирует React приложение и монтирует его в DOM.
 * 
 * ВАЖНО: React.StrictMode временно отключен из-за известной проблемы совместимости
 * React 19 с MUI (ошибка removeChild). Это будет исправлено в будущих версиях MUI.
 * В production это не влияет на работу приложения.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Монтирование приложения в корневой элемент
// ВАЖНО: React.StrictMode временно отключен из-за известной проблемы совместимости
// React 19 с MUI (ошибка removeChild). Это будет исправлено в будущих версиях MUI.
// В production это не влияет на работу приложения.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

