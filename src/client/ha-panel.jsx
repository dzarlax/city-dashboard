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
      this.shadowRoot.appendChild(root);

      createRoot(root).render(
        <React.StrictMode>
          <TransportCard />
        </React.StrictMode>
      );
    }
  }
}

customElements.define('city-dashboard-panel', CityDashboardPanel); 