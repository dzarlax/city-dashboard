import os
import shutil
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"
HACS_PANEL_URL = "/hacsfiles/city_dashboard/dashboard.js"

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

    if not os.path.exists(dest_js):
        shutil.copyfile(source_js, dest_js)
    if not os.path.exists(hacs_js):
        shutil.copyfile(source_js, hacs_js)

    # Добавляем панель в HA с поддержкой HACS
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