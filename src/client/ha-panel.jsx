import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from './ha-panel.css?inline'  // Импортируем CSS как строку
import App from './App'

class CityDashboard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    
    // Создаем shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // Создаем контейнер для React
    const container = document.createElement('div');
    container.id = 'root';
    this.shadowRoot.appendChild(container);
    
    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = styles;  // Используем импортированные стили
    this.shadowRoot.appendChild(style);
    
    // Рендерим React в контейнер
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }

  // Получаем конфигурацию от Home Assistant
  setConfig(config) {
    this._config = config;
  }

  // Получаем объект hass от Home Assistant
  set hass(hass) {
    this._hass = hass;
    window.hassConnection = Promise.resolve({
      config: hass.config,
      auth: hass.auth,
      connection: hass.connection,
    });
  }
}

customElements.define('city-dashboard', CityDashboard); 