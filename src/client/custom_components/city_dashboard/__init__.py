"""The City Dashboard integration."""
import os
import logging
from homeassistant.core import HomeAssistant
from homeassistant.components.frontend import add_extra_js_url
from .const import DOMAIN, NAME, VERSION

_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up this integration using YAML."""
    
    # Register the web application as a panel
    hass.components.frontend.async_register_built_in_panel(
        "iframe",
        NAME,
        "mdi:bus",
        DOMAIN,
        {"url": "https://transport.dzarlax.dev"},
        require_admin=False
    )

    return True