import os
import shutil
import logging
import time
from pathlib import Path
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

DOMAIN = "city_dashboard"
PANEL_URL = "/local/city_dashboard/dashboard.js"
HACS_PANEL_URL = "/hacsfiles/city_dashboard/dashboard.js"

REACT_VERSION = "17"
REACT_CDN = f"https://unpkg.com/react@{REACT_VERSION}/umd/react.production.min.js"
REACT_DOM_CDN = f"https://unpkg.com/react-dom@{REACT_VERSION}/umd/react-dom.production.min.js"

_LOGGER = logging.getLogger(__name__)

REQUIRED_FILES = [
    "dashboard.js",
    "assets",
    "index.html"
]

async def verify_assets(hass: HomeAssistant) -> bool:
    """Verify that all required assets are present."""
    base_path = hass.config.path("www/community/city_dashboard")
    
    for file in REQUIRED_FILES:
        file_path = os.path.join(base_path, file)
        if not os.path.exists(file_path):
            _LOGGER.error(f"Missing required file: {file} at {file_path}")
            return False
    return True

async def copy_assets(hass: HomeAssistant) -> bool:
    """Copy assets from the integration directory to www directory."""
    try:
        integration_dir = os.path.dirname(__file__)
        www_path = hass.config.path("www/city_dashboard")
        hacs_path = hass.config.path("www/community/city_dashboard")

        # Ensure directories exist
        os.makedirs(www_path, exist_ok=True)
        os.makedirs(hacs_path, exist_ok=True)

        # Copy all required files
        for file in REQUIRED_FILES:
            source = os.path.join(integration_dir, file)
            www_dest = os.path.join(www_path, file)
            hacs_dest = os.path.join(hacs_path, file)

            if os.path.isdir(source):
                await hass.async_add_executor_job(shutil.copytree, source, www_dest, dirs_exist_ok=True)
                await hass.async_add_executor_job(shutil.copytree, source, hacs_dest, dirs_exist_ok=True)
            else:
                await hass.async_add_executor_job(shutil.copy2, source, www_dest)
                await hass.async_add_executor_job(shutil.copy2, source, hacs_dest)

        return True
    except Exception as e:
        _LOGGER.error(f"Failed to copy assets: {e}")
        return False

async def add_lovelace_resources(hass: HomeAssistant, resources: list):
    """Add resources to Lovelace automatically."""
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
            try:
                await resource_storage.async_create_item({
                    "url": resource["url"],
                    "type": resource["res_type"],
                    "version": str(time.time())  # Cache busting
                })
                _LOGGER.info(f"Added Lovelace resource: {resource['url']}")
            except Exception as e:
                _LOGGER.error(f"Failed to add Lovelace resource {resource['url']}: {e}")

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up City Dashboard from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Verify and copy assets
    if not await verify_assets(hass):
        _LOGGER.info("Assets missing, attempting to copy from integration directory...")
        if not await copy_assets(hass):
            raise HomeAssistantError("Failed to copy required assets")

    # Add Lovelace resources with cache busting
    version = str(time.time())
    await add_lovelace_resources(hass, [
        {"url": f"{REACT_CDN}?v={version}", "res_type": "module"},
        {"url": f"{REACT_DOM_CDN}?v={version}", "res_type": "module"},
        {"url": f"{HACS_PANEL_URL}?v={version}", "res_type": "module"},
    ])

    # Register the panel
    panel_path = "/local/city_dashboard/index.html"
    if not os.path.exists(hass.config.path("www/community/city_dashboard/index.html")):
        panel_path = "/hacsfiles/city_dashboard/index.html"

    hass.components.frontend.async_register_built_in_panel(
        component_name="iframe",
        sidebar_title="City Dashboard",
        sidebar_icon="mdi:city",
        frontend_url_path="city_dashboard_panel",
        config={"url": f"{panel_path}?v={version}"},  # Add cache busting
        require_admin=False,
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Remove panel
    if "city_dashboard_panel" in hass.data.get("frontend_panels", {}):
        hass.components.frontend.async_remove_panel("city_dashboard_panel")
    
    return True