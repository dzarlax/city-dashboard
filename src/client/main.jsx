import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker
serviceWorkerRegistration.register();

// Optional: Add periodic updates
setInterval(() => {
  serviceWorkerRegistration.checkForUpdates();
}, 3600000); // Check every hour