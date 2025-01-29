export const getHomeAssistantConfig = async () => {
    if (!window.hassConnection) {
      return null;
    }
  
    try {
      const config = await window.hassConnection.sendMessagePromise({
        type: 'get_config'
      });
      return {
        latitude: config.latitude,
        longitude: config.longitude
      };
    } catch (error) {
      console.warn('Failed to get Home Assistant config:', error);
      return null;
    }
  };