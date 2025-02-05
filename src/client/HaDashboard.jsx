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
  }

  /* Базовые стили Tailwind */
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* Кастомные стили для компонентов */
  .dashboard-container {
    padding: 16px;
    max-width: 1280px;
    margin: 0 auto;
  }

  .station-card {
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color, #e5e7eb);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .station-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 8px;
  }

  .station-info {
    color: var(--secondary-text-color);
    font-size: 0.875rem;
  }

  .weather-section {
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color, #e5e7eb);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .weather-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 16px;
  }

  /* Переопределение Tailwind классов */
  .bg-white {
    background-color: var(--card-background-color, #fff) !important;
  }

  .text-gray-800 {
    color: var(--primary-text-color) !important;
  }

  .text-gray-500 {
    color: var(--secondary-text-color) !important;
  }

  .border-gray-200 {
    border-color: var(--divider-color, #e5e7eb) !important;
  }

  .shadow-sm {
    box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,0.12)) !important;
  }

  /* Исправление размеров контейнера */
  #root {
    height: 100%;
    width: 100%;
    max-width: none;
    padding: 16px;
  }

  .min-h-screen {
    min-height: 100%;
    background-color: var(--primary-background-color);
  }
`;

const HaDashboard = () => {
  return (
    <div className="dashboard-container">
      <style>{styles}</style>
      <Dashboard />
    </div>
  );
};

export default HaDashboard; 