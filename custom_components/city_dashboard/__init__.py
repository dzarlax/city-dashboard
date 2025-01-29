from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "city_dashboard"

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    hass.data[DOMAIN][entry.entry_id] = {
        "geo_source": entry.options.get("geo_source", "homeassistant"),
        "latitude": entry.options.get("latitude", hass.config.latitude),
        "longitude": entry.options.get("longitude", hass.config.longitude),
    }

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload City Dashboard config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)
    return True