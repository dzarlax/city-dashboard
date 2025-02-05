// Регистрируем панель
const registerPanel = () => {
  const ha = customElements.get('home-assistant');
  if (ha) {
    ha.registerPanel(
      "city-dashboard",
      {
        name: "City Dashboard",
        icon: "mdi:bus",
        url_path: "city-dashboard",
        component_name: "city-dashboard-panel"
      }
    );
  }
};

// Импортируем компонент панели
import('./ha-panel.jsx')
  .then(() => {
    console.log('Panel component loaded');
    registerPanel();
  })
  .catch(err => {
    console.error('Failed to load panel:', err);
  }); 