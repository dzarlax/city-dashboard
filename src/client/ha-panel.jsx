import React from 'react';
import { createRoot } from 'react-dom/client';
import TransportCard from './TransportCard';

class CityDashboardCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      const card = document.createElement('ha-card');
      card.header = this._config.name || 'Transport Info';
      this.shadowRoot.appendChild(card);

      const style = document.createElement('style');
      style.textContent = `
        .station-card {
          padding: 16px;
          border-bottom: 1px solid var(--divider-color);
        }
        .station-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .station-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }
        .station-icon {
          width: 20px;
          height: 20px;
          color: var(--primary-color);
        }
        .line-info {
          margin-top: 8px;
        }
        .line-number {
          background: var(--primary-color);
          color: var(--text-primary-color);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.9em;
        }
        .arrival-times {
          margin-top: 4px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .arrival-time {
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }
      `;
      card.appendChild(style);

      const content = document.createElement('div');
      content.className = 'card-content';
      card.appendChild(content);

      const root = createRoot(content);
      root.render(
        <React.StrictMode>
          <TransportCard config={this._config} />
        </React.StrictMode>
      );
    }
  }
}

customElements.define('city-dashboard-card', CityDashboardCard); 