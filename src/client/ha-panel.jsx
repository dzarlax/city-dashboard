import React from 'react';
import { createRoot } from 'react-dom/client';
import TransportCard from './TransportCard';
import { getHomeAssistantConfig } from './utils/homeAssistant';

class CityDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.config = null;
  }

  async connectedCallback() {
    // Получаем конфигурацию
    this.config = await getHomeAssistantConfig();

    // Создаем контейнер
    const container = document.createElement('div');
    container.style.cssText = `
      height: 100%;
      padding: 16px;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
    `;
    this.shadowRoot.appendChild(container);

    // Рендерим React компонент
    const root = createRoot(container);
    root.render(<TransportCard config={this.config} />);
  }
}

// Регистрируем элемент
if (!customElements.get('city-dashboard-panel')) {
  customElements.define('city-dashboard-panel', CityDashboardPanel);
} 