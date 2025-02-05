"""The City Dashboard integration."""
import os
import shutil
import logging
from pathlib import Path
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError
from homeassistant.components import frontend

from .const import DOMAIN, NAME, VERSION

_LOGGER = logging.getLogger(__name__)
PLATFORMS: list[str] = []

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the City Dashboard component."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    if entry.options.get("add_sidebar", True):
        _LOGGER.debug("Registering panel for City Dashboard")
        frontend.async_remove_panel(hass, "city-dashboard")
        
        frontend.async_register_built_in_panel(
            hass,
            "custom",
            sidebar_title=NAME,
            sidebar_icon="mdi:view-dashboard",
            frontend_url_path="city-dashboard",
            require_admin=False,
            config={
                "_panel_custom": {
                    "name": "city-dashboard",
                    "module_url": "/hacsfiles/city_dashboard/dashboard.js",
                    "embed_iframe": True,
                    "trust_external": True
                }
            }
        )

    # File operations in executor
    def copy_files():
        component_path = Path(__file__).parent
        www_path = Path(hass.config.path("www")) / "community" / "city_dashboard"
        www_path.mkdir(parents=True, exist_ok=True)
        
        _LOGGER.debug("Component path: %s", component_path)
        
        # Сначала проверяем dist директорию (при разработке)
        component_www = Path(__file__).parent.parent.parent / "dist"
        _LOGGER.debug("Checking dist path: %s", component_www)
        
        if not component_www.exists():
            # Если dist нет, используем www директорию (в HACS)
            component_www = component_path / "www"
            _LOGGER.debug("Checking local www path: %s", component_www)
            if not component_www.exists():
                _LOGGER.error("Neither dist nor www directory exists")
                _LOGGER.error("Current directory contents: %s", 
                    list(Path(__file__).parent.parent.parent.iterdir()))
                raise HomeAssistantError(f"Missing www directory in both locations: {component_www}")

        # Copy dashboard.js
        dashboard_src = component_www / "dashboard.js"
        dashboard_dst = www_path / "dashboard.js"
        _LOGGER.debug("Looking for dashboard.js at: %s", dashboard_src)
        if dashboard_src.exists():
            _LOGGER.debug("Found dashboard.js, copying to: %s", dashboard_dst)
            shutil.copy2(dashboard_src, dashboard_dst)
        else:
            _LOGGER.error("Directory contents: %s", list(component_www.iterdir()))
            raise HomeAssistantError(f"Missing required file: {dashboard_src}")

        # Copy assets
        assets_src = component_www / "assets"
        assets_dst = www_path / "assets"
        if assets_src.exists():
            _LOGGER.debug("Copying assets from %s to %s", assets_src, assets_dst)
            if assets_dst.exists():
                shutil.rmtree(assets_dst)
            shutil.copytree(assets_src, assets_dst)
        else:
            raise HomeAssistantError(f"Missing required directory: {assets_src}")

    try:
        await hass.async_add_executor_job(copy_files)
    except Exception as err:
        _LOGGER.error("Failed to copy files: %s", err)
        return False

    # Store configuration
    hass.data[DOMAIN][entry.entry_id] = {
        "options": entry.options,
        "version": VERSION
    }

    # Register update listener
    entry.async_on_unload(entry.add_update_listener(update_listener))

    # Load platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        if entry.options.get("add_sidebar", True):
            frontend.async_remove_panel(hass, "city-dashboard")
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok

async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update."""
    await hass.config_entries.async_reload(entry.entry_id)