import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'
import './App.css'
import App from './App'

class CityDashboard extends HTMLElement {
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