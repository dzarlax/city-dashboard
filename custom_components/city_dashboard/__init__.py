import os
import shutil
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"
HACS_PANEL_URL = "/hacsfiles/city_dashboard/dashboard.js"

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Определяем путь в зависимости от установки
    www_path = hass.config.path("www/city_dashboard")
    hacs_path = hass.config.path("www/community/city_dashboard")

    os.makedirs(www_path, exist_ok=True)
    os.makedirs(hacs_path, exist_ok=True)

    source_js = os.path.join(os.path.dirname(__file__), "dashboard.js")
    dest_js = os.path.join(www_path, "dashboard.js")
    hacs_js = os.path.join(hacs_path, "dashboard.js")

    if not os.path.exists(source_js):
        _LOGGER.error(f"Dashboard.js is missing: {source_js}")
        return False

    # Используем асинхронное копирование файлов
    try:
        await hass.async_add_executor_job(shutil.copyfile, source_js, dest_js)
        await hass.async_add_executor_job(shutil.copyfile, source_js, hacs_js)
    except Exception as e:
        _LOGGER.error(f"Failed to copy dashboard.js: {e}")
        return False

    panel_url = HACS_PANEL_URL if os.path.exists(hacs_js) else PANEL_URL

    if entry.options.get("add_sidebar", True):
        hass.components.frontend.async_register_built_in_panel(
            component_name="iframe",
            sidebar_title="City Dashboard",
            sidebar_icon="mdi:city",
            config={"url": panel_url},
            require_admin=False
        )

    return True