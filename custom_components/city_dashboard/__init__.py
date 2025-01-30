"""The City Dashboard integration."""
import os
import shutil
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError
import logging

from .const import DOMAIN, NAME, VERSION

_LOGGER = logging.getLogger(__name__)
PLATFORMS: list[str] = []

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the City Dashboard component."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # Определяем пути
    component_path = os.path.dirname(os.path.realpath(__file__))
    www_path = os.path.join(hass.config.path("www"), "community", "city_dashboard")
    
    # Создаем директорию если её нет
    os.makedirs(www_path, exist_ok=True)
    
    try:
        # Проверяем наличие собранных файлов в www директории компонента
        component_www = os.path.join(component_path, "www")
        if not os.path.exists(component_www):
            raise HomeAssistantError(f"Missing www directory in component: {component_www}")

        # Копируем dashboard.js
        dashboard_src = os.path.join(component_www, "dashboard.js")
        dashboard_dst = os.path.join(www_path, "dashboard.js")
        if os.path.exists(dashboard_src):
            _LOGGER.debug("Copying dashboard.js from %s to %s", dashboard_src, dashboard_dst)
            shutil.copy2(dashboard_src, dashboard_dst)
        else:
            raise HomeAssistantError(f"Missing required file: {dashboard_src}")
        
        # Копируем assets
        assets_src = os.path.join(component_www, "assets")
        assets_dst = os.path.join(www_path, "assets")
        if os.path.exists(assets_src):
            _LOGGER.debug("Copying assets from %s to %s", assets_src, assets_dst)
            if os.path.exists(assets_dst):
                shutil.rmtree(assets_dst)
            shutil.copytree(assets_src, assets_dst)
        else:
            raise HomeAssistantError(f"Missing required directory: {assets_src}")
            
    except Exception as err:
        _LOGGER.error("Failed to copy files: %s", err)
        raise HomeAssistantError(f"Failed to copy required files: {err}")

    # Сохраняем конфигурацию
    hass.data[DOMAIN][entry.entry_id] = {
        "options": entry.options,
        "version": VERSION
    }

    # Регистрируем обработчик обновления конфигурации
    entry.async_on_unload(entry.add_update_listener(update_listener))

    # Загружаем платформы
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Выгружаем платформы
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        # Удаляем данные конфигурации
        hass.data[DOMAIN].pop(entry.entry_id)
        
        try:
            # Удаляем файлы
            www_path = os.path.join(hass.config.path("www"), "community", "city_dashboard")
            if os.path.exists(www_path):
                shutil.rmtree(www_path)
        except Exception as err:
            _LOGGER.error("Error cleaning up files: %s", err)

    return unload_ok

async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update."""
    await hass.config_entries.async_reload(entry.entry_id)