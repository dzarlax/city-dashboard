class CityDashboardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  get _name() {
    return this._config.name || '';
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <form class="row">
          <ha-formfield label="Name">
            <ha-textfield
              .value="${this._name}"
              .configValue="${"name"}"
              @input="${this._valueChanged}"
            ></ha-textfield>
          </ha-formfield>
        </form>
      `;
    }
  }

  _valueChanged(ev) {
    if (!this._config || !this.shadowRoot) return;

    const target = ev.target;
    if (target.configValue) {
      this._config = {
        ...this._config,
        [target.configValue]: target.value,
      };
    }
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }
}

customElements.define('city-dashboard-card-editor', CityDashboardCardEditor); 