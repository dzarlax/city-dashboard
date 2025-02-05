class CityDashboardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
    
    this.shadowRoot.innerHTML = `
      <style>
        .form-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        ha-textfield {
          width: 100%;
        }
      </style>
      <div class="form-container">
        <ha-textfield
          label="Name"
          .value="${this._config.name || ''}"
          .configValue="${"name"}"
          @input="${this._valueChanged}"
        ></ha-textfield>
        
        <ha-textfield
          label="Latitude"
          .value="${this._config.latitude || '44.8178131'}"
          .configValue="${"latitude"}"
          @input="${this._valueChanged}"
        ></ha-textfield>
        
        <ha-textfield
          label="Longitude"
          .value="${this._config.longitude || '20.4568974'}"
          .configValue="${"longitude"}"
          @input="${this._valueChanged}"
        ></ha-textfield>
        
        <ha-textfield
          label="Search Radius (meters)"
          .value="${this._config.radius || '500'}"
          .configValue="${"radius"}"
          @input="${this._valueChanged}"
        ></ha-textfield>
        
        <ha-textfield
          label="Update Interval (seconds)"
          .value="${this._config.update_interval || '60'}"
          .configValue="${"update_interval"}"
          @input="${this._valueChanged}"
        ></ha-textfield>
      </div>
    `;
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