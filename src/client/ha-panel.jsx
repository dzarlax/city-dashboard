import React from 'react';
import { createRoot } from 'react-dom/client';
import './ha-panel.css'  // Используем единый файл для HA
import App from './App'

class CityDashboard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
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

  connectedCallback() {
    const root = createRoot(this);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

customElements.define('city-dashboard', CityDashboard); 