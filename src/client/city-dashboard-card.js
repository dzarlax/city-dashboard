import './ha-panel.jsx';

// Регистрируем карточку для Lovelace
if (window.customElements && !customElements.get('city-dashboard-card')) {
  console.info('Регистрация city-dashboard-card');
  
  // Регистрируем карточку в CUSTOM_CARDS
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "city-dashboard-card",
    name: "City Dashboard Card",
    description: "A card showing public transport information",
    preview: true,
    configurable: true,
  });

  class CityDashboardCard extends HTMLElement {
    static async getConfigElement() {
      await import('./card-editor.js');
      return document.createElement('city-dashboard-card-editor');
    }

    static getStubConfig() {
      return { 
        name: "City Dashboard",
        latitude: "44.8178131",
        longitude: "20.4568974",
        radius: "500",
        update_interval: "60"
      };
    }

    constructor() {
      super();
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      if (!config) {
        throw new Error('Invalid configuration');
      }
      this._config = config;
      this._render();
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

        import('./ha-panel.jsx').then(({ default: TransportCard }) => {
          const { createRoot } = require('react-dom/client');
          const root = createRoot(content);
          root.render(
            <React.StrictMode>
              <TransportCard config={this._config} />
            </React.StrictMode>
          );
        }).catch((error) => {
          console.error('Error loading TransportCard:', error);
          content.innerHTML = `<div>Error loading card: ${error.message}</div>`;
        });
      }
    }

    getCardSize() {
      return 3;
    }
  }

  customElements.define('city-dashboard-card', CityDashboardCard);
  console.info('City Dashboard Card зарегистрирована');
} 