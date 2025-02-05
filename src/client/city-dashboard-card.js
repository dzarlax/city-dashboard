import './ha-panel.jsx';

window.customCards = window.customCards || [];
window.customCards.push({
  type: "city-dashboard-card",
  name: "City Dashboard Card",
  description: "A card showing public transport and weather information",
  preview: true,
  configurable: true,
});

// Регистрируем карточку для Lovelace UI
if (!customElements.get('city-dashboard-card')) {
  customElements.define('city-dashboard-card', class extends HTMLElement {
    static async getConfigElement() {
      await import('./card-editor.js');
      return document.createElement('city-dashboard-card-editor');
    }

    static getStubConfig() {
      return { 
        name: "City Dashboard",
        update_interval: 60
      };
    }

    setConfig(config) {
      if (!config) {
        throw new Error('Invalid configuration');
      }
      this._config = config;
    }

    getCardSize() {
      return 12;
    }
  });
} 