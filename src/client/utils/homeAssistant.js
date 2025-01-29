export const getHomeAssistantConfig = async () => {
    if (!window.hassConnection) {
      return null;
    }

    try {
      // Получаем глобальные настройки HA
      const config = await window.hassConnection.sendMessagePromise({ type: 'get_config' });

      // Получаем настройки интеграции
      const entries = await window.hassConnection.sendMessagePromise({ type: 'config_entries/get' });
      const cityDashboardEntry = entries.find(entry => entry.domain === 'city_dashboard');

      if (!cityDashboardEntry) {
        console.warn('City Dashboard integration not found');
        return {
          latitude: config.latitude,
          longitude: config.longitude
        };
      }

      const options = cityDashboardEntry.options || {};
      const geoSource = options.geo_source || 'homeassistant';

      if (geoSource === 'manual') {
        return {
          latitude: options.latitude || config.latitude,
          longitude: options.longitude || config.longitude
        };
      }

      return {
        latitude: config.latitude,
        longitude: config.longitude
      };
    } catch (error) {
      console.warn('Failed to get Home Assistant config:', error);
      return null;
    }
};