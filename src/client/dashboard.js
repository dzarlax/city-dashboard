import './ha-panel.jsx';

customElements.get('home-assistant')?.registerPanel(
  "city-dashboard",
  "City Dashboard",
  "mdi:bus"
); 