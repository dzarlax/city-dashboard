from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    hass.data[DOMAIN][entry.entry_id] = {
        "geo_source": entry.options.get("geo_source", "homeassistant"),
        "latitude": entry.options.get("latitude", hass.config.latitude),
        "longitude": entry.options.get("longitude", hass.config.longitude),
        "add_sidebar": entry.options.get("add_sidebar", True)
    }

    # 🏆 Если панель включена в настройках — добавляем её
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
    """Unload City Dashboard config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)

    # ❌ Удаляем панель
    if entry.options.get("add_sidebar", True):
        hass.components.frontend.async_remove_panel("city_dashboard")  # ✅ Фиксируем ID панели

    return True