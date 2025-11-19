/**
 * Точка входа React приложения
 * 
 * Инициализирует React приложение и монтирует его в DOM.
 * React.StrictMode включен для дополнительных проверок в development режиме.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Монтирование приложения в корневой элемент
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

