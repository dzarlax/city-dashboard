import React from 'react';
import { createRoot } from 'react-dom/client';
import TransportCard from './TransportCard';

class CityDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });

      const root = document.createElement('div');
      root.style.cssText = `
        height: 100%;
        padding: var(--ha-card-padding, 16px);
      `;
      this.shadowRoot.appendChild(root);

      createRoot(root).render(
        <TransportCard />
      );
    }
  }
}

customElements.define('city-dashboard-panel', CityDashboardPanel); 