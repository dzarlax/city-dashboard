import './ha-panel.jsx';

// Регистрируем панель
if (customElements.get('home-assistant')) {
  customElements.get('home-assistant').registerPanel(
    "city-dashboard",
    {
      name: "City Dashboard",
      icon: "mdi:bus",
      url_path: "city-dashboard"
    }
  );
} 