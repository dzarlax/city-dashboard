import React from 'react';
import Dashboard from './Dashboard';

// Минимальные стили для интеграции
const styles = `
  :host {
    display: block;
    height: 100%;
  }

  .ha-dashboard {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--ha-card-padding, 16px);
    background: var(--ha-card-background, var(--card-background-color));
  }

  .ha-card {
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 4px);
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
    display: flex;
    flex-direction: column;
    margin-bottom: var(--ha-card-margin, 16px);
    padding: var(--ha-card-padding, 16px);
  }

  .ha-card-header {
    color: var(--ha-card-header-color, var(--primary-text-color));
    font-family: var(--ha-card-header-font-family, inherit);
    font-size: var(--ha-card-header-font-size, 24px);
    font-weight: var(--ha-card-header-font-weight, normal);
    margin-bottom: var(--ha-card-margin, 16px);
  }

  .ha-card-content {
    color: var(--primary-text-color);
    padding: var(--ha-card-padding, 16px);
  }
`;

// Обертка для Dashboard с нативными стилями HA
const HaDashboard = () => {
  return (
    <ha-card>
      <style>{styles}</style>
      <div className="ha-dashboard">
        <div className="ha-card">
          <div className="ha-card-header">
            City Dashboard
          </div>
          <div className="ha-card-content">
            <Dashboard />
          </div>
        </div>
      </div>
    </ha-card>
  );
};

export default HaDashboard; 