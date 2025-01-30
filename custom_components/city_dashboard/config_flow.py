import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

DOMAIN = "city_dashboard"

class CityDashboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow for City Dashboard."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Step to configure integration via UI."""
        errors = {}

        if user_input is not None:
            # Проверяем, если выбран ручной ввод координат, заданы ли значения
            if user_input["geo_source"] == "manual":
                if not user_input.get("latitude") or not user_input.get("longitude"):
                    errors["base"] = "invalid_coordinates"
                else:
                    return self.async_create_entry(
                        title="City Dashboard",
                        data={},
                        options=user_input
                    )

            # Если выбран Home Assistant, просто создаем запись
            return self.async_create_entry(
                title="City Dashboard",
                data={},
                options=user_input
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
            {
                vol.Required("geo_source", default="homeassistant"): vol.In(
                    {"homeassistant": "Использовать HA", "manual": "Ввести вручную"}
                ),
                vol.Optional("latitude", default=44.7866): vol.Coerce(float),
                vol.Optional("longitude", default=20.4489): vol.Coerce(float),
                vol.Optional("add_sidebar", default=True): bool,
            }
        ),
            errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(entry):
        return CityDashboardOptionsFlow(entry)

class CityDashboardOptionsFlow(config_entries.OptionsFlow):
    """Manage options for City Dashboard."""

    def __init__(self, entry):
        self.entry = entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        if user_input is not None:
            self.hass.config_entries.async_update_entry(self.entry, options=user_input)
            return self.async_create_entry(title="", data={})

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required("geo_source", default="homeassistant"): vol.In(
                        {"homeassistant": "Использовать HA", "manual": "Ввести вручную"}
                    ),
                    vol.Optional("latitude", default=44.7866): vol.Coerce(float),
                    vol.Optional("longitude", default=20.4489): vol.Coerce(float),
                    vol.Optional("add_sidebar", default=True): bool,
                }
            ),
        )