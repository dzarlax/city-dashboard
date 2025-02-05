"""Config flow for City Dashboard integration."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.const import CONF_LATITUDE, CONF_LONGITUDE

from .const import DOMAIN, NAME

# Configuration constants
CONF_GEO_SOURCE = "geo_source"
CONF_ADD_SIDEBAR = "add_sidebar"

GEO_SOURCE_HA = "homeassistant"
GEO_SOURCE_MANUAL = "manual"

class CityDashboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow for City Dashboard."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle a flow initialized by the user."""
        errors = {}

        # Проверяем, нет ли уже настроенной интеграции
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            if user_input[CONF_GEO_SOURCE] == GEO_SOURCE_MANUAL:
                if not user_input.get(CONF_LATITUDE) or not user_input.get(CONF_LONGITUDE):
                    errors["base"] = "invalid_coordinates"
                else:
                    return self.async_create_entry(
                        title=NAME,
                        data={},
                        options=user_input
                    )
            else:
                # Используем координаты HA
                return self.async_create_entry(
                    title=NAME,
                    data={},
                    options={
                        CONF_GEO_SOURCE: user_input[CONF_GEO_SOURCE],
                        CONF_LATITUDE: self.hass.config.latitude,
                        CONF_LONGITUDE: self.hass.config.longitude,
                        CONF_ADD_SIDEBAR: user_input.get(CONF_ADD_SIDEBAR, True)
                    }
                )

        # Значения по умолчанию
        default_values = {
            CONF_GEO_SOURCE: GEO_SOURCE_HA,
            CONF_LATITUDE: self.hass.config.latitude,
            CONF_LONGITUDE: self.hass.config.longitude,
            CONF_ADD_SIDEBAR: True
        }

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_GEO_SOURCE, default=default_values[CONF_GEO_SOURCE]): vol.In({
                    GEO_SOURCE_HA: "Use Home Assistant location",
                    GEO_SOURCE_MANUAL: "Enter manually"
                }),
                vol.Optional(CONF_LATITUDE, 
                    default=default_values[CONF_LATITUDE]): vol.Coerce(float),
                vol.Optional(CONF_LONGITUDE, 
                    default=default_values[CONF_LONGITUDE]): vol.Coerce(float),
                vol.Optional(CONF_ADD_SIDEBAR, 
                    default=default_values[CONF_ADD_SIDEBAR]): bool,
            }),
            errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for City Dashboard."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        errors = {}

        if user_input is not None:
            if user_input[CONF_GEO_SOURCE] == GEO_SOURCE_MANUAL:
                if not user_input.get(CONF_LATITUDE) or not user_input.get(CONF_LONGITUDE):
                    errors["base"] = "invalid_coordinates"
                else:
                    return self.async_create_entry(title="", data=user_input)
            else:
                return self.async_create_entry(title="", data={
                    CONF_GEO_SOURCE: user_input[CONF_GEO_SOURCE],
                    CONF_LATITUDE: self.hass.config.latitude,
                    CONF_LONGITUDE: self.hass.config.longitude,
                    CONF_ADD_SIDEBAR: user_input.get(CONF_ADD_SIDEBAR, True)
                })

        # Get current options or defaults
        current_config = self.config_entry.options
        options = {
            CONF_GEO_SOURCE: current_config.get(CONF_GEO_SOURCE, GEO_SOURCE_HA),
            CONF_LATITUDE: current_config.get(CONF_LATITUDE, self.hass.config.latitude),
            CONF_LONGITUDE: current_config.get(CONF_LONGITUDE, self.hass.config.longitude),
            CONF_ADD_SIDEBAR: current_config.get(CONF_ADD_SIDEBAR, True)
        }

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_GEO_SOURCE, default=options[CONF_GEO_SOURCE]): vol.In({
                    GEO_SOURCE_HA: "Use Home Assistant location",
                    GEO_SOURCE_MANUAL: "Enter manually"
                }),
                vol.Optional(CONF_LATITUDE, 
                    default=options[CONF_LATITUDE]): vol.Coerce(float),
                vol.Optional(CONF_LONGITUDE, 
                    default=options[CONF_LONGITUDE]): vol.Coerce(float),
                vol.Optional(CONF_ADD_SIDEBAR, 
                    default=options[CONF_ADD_SIDEBAR]): bool,
            }),
            errors=errors
        )