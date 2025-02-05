import React from 'react';
import Dashboard from './Dashboard';

// Стили для Shadow DOM
const styles = `
  :host {
    display: block;
    height: 100%;
    width: 100%;
    background-color: var(--primary-background-color);
    color: var(--primary-text-color);
    --primary-text-color: var(--primary-text-color, #212121);
    --primary-background-color: var(--primary-background-color, #fafafa);
  }

  /* Базовые стили Tailwind */
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* Кастомные стили */
  #root {
    height: 100%;
    width: 100%;
  }

  .min-h-screen {
    min-height: 100%;
  }

  /* Переопределяем цвета для темной темы */
  :host-context([data-theme='dark']) {
    --primary-text-color: var(--primary-text-color, #e1e1e1);
    --primary-background-color: var(--primary-background-color, #111111);
  }
`;

// Компонент-обертка для Home Assistant
const HaDashboard = () => {
  return (
    <div id="root">
      <style>{styles}</style>
      <Dashboard />
    </div>
  );
};

export default HaDashboard; 