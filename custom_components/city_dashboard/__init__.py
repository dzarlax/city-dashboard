import os
import shutil
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # 🏆 Копируем dashboard.js в /config/www/city_dashboard/
    www_path = hass.config.path("www/city_dashboard")
    os.makedirs(www_path, exist_ok=True)

    source_js = os.path.join(os.path.dirname(__file__), "dashboard.js")
    dest_js = os.path.join(www_path, "dashboard.js")

    if not os.path.exists(dest_js):
        shutil.copyfile(source_js, dest_js)

    # 🏆 Добавляем панель в HA
    if entry.options.get("add_sidebar", True):
        hass.components.frontend.async_register_built_in_panel(
            component_name="iframe",
            sidebar_title="City Dashboard",
            sidebar_icon="mdi:city",
            config={"url": PANEL_URL},
            require_admin=False
        )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Удаляем панель при удалении интеграции."""
    hass.data[DOMAIN].pop(entry.entry_id)

    if entry.options.get("add_sidebar", True):
        hass.components.frontend.async_remove_panel("city_dashboard")

    return True