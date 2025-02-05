import React from 'react';
import Dashboard from './Dashboard';

// Стили для интеграции с Home Assistant
const styles = `
  ha-panel-custom {
    height: 100%;
    width: 100%;
  }

  city-dashboard {
    display: block;
    height: 100%;
    width: 100%;
    background-color: var(--primary-background-color);
    color: var(--primary-text-color);
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
    background-color: var(--primary-background-color);
  }

  /* Адаптация под тему HA */
  .bg-white {
    background-color: var(--card-background-color, #fff);
  }

  .text-gray-800 {
    color: var(--primary-text-color);
  }

  .text-gray-500 {
    color: var(--secondary-text-color);
  }

  .border-gray-200 {
    border-color: var(--divider-color);
  }

  .shadow-sm {
    box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,0.12));
  }
`;

// Компонент-обертка для Home Assistant
const HaDashboard = () => {
  return (
    <>
      <style>{styles}</style>
      <Dashboard />
    </>
  );
};

export default HaDashboard; 