import React from 'react';
import { createRoot } from 'react-dom/client';
import HaDashboard from './HaDashboard';

class CityDashboard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    
    // Создаем shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // Создаем контейнер для React
    const container = document.createElement('div');
    container.style.height = '100%';
    this.shadowRoot.appendChild(container);
    
    // Рендерим React в контейнер
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <HaDashboard />
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