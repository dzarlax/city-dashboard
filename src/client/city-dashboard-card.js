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

  // Импортируем компонент карточки
  import('./ha-panel.jsx').then(() => {
    console.info('City Dashboard Card загружена');
  }).catch((error) => {
    console.error('Ошибка загрузки City Dashboard Card:', error);
  });
} 