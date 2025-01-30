import os
import shutil
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.components.lovelace.resources import ResourceStorageCollection

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"
HACS_PANEL_URL = "/hacsfiles/city_dashboard/dashboard.js"

REACT_CDN = "/hacsfiles/react/react.production.min.js"
REACT_DOM_CDN = "/hacsfiles/react/react-dom.production.min.js"

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Определяем пути для файлов
    www_path = hass.config.path("www/city_dashboard")
    hacs_path = hass.config.path("www/community/city_dashboard")
    source_js = os.path.join(os.path.dirname(__file__), "dashboard.js")
    dest_js = os.path.join(www_path, "dashboard.js")
    hacs_js = os.path.join(hacs_path, "dashboard.js")

    # Создаем папки, если их нет
    os.makedirs(www_path, exist_ok=True)
    os.makedirs(hacs_path, exist_ok=True)

    # Проверяем наличие исходного файла
    if not os.path.exists(source_js):
        _LOGGER.error(f"Dashboard.js is missing: {source_js}")
        return False

    # Асинхронное копирование файлов
    try:
        _LOGGER.info(f"Copying dashboard.js to {dest_js} and {hacs_js}")
        await hass.async_add_executor_job(shutil.copyfile, source_js, dest_js)
        await hass.async_add_executor_job(shutil.copyfile, source_js, hacs_js)
    except Exception as e:
        _LOGGER.error(f"Failed to copy dashboard.js: {e}")
        return False

    # Новый способ регистрации статических путей
    await hass.http.async_register_static_paths([
        {"path": REACT_CDN, "local_path": "https://unpkg.com/react@17/umd/react.production.min.js", "cache": False},
        {"path": REACT_DOM_CDN, "local_path": "https://unpkg.com/react-dom@17/umd/react-dom.production.min.js", "cache": False},
    ])

    # Регистрация ресурсов Lovelace
    await add_lovelace_resources(hass, [
        {"url": REACT_CDN, "type": "module"},
        {"url": REACT_DOM_CDN, "type": "module"},
        {"url": PANEL_URL, "type": "module"}
    ])

    return True


async def add_lovelace_resources(hass: HomeAssistant, resources: list):
    """Добавить ресурсы в Lovelace автоматически."""
    if "lovelace" not in hass.data:
        _LOGGER.warning("Lovelace storage not found. Cannot register resources.")
        return

    resource_storage = hass.data["lovelace"].get("resources")
    if resource_storage is None:
        _LOGGER.warning("Lovelace resources storage not found.")
        return

    existing_resources = [item["url"] for item in resource_storage.async_items()]
    for resource in resources:
        if resource["url"] not in existing_resources:
            await resource_storage.async_create_item(resource)
            _LOGGER.info(f"Added Lovelace resource: {resource['url']}")