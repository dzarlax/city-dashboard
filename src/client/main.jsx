import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { ThemeProvider } from './utils/ThemeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// Register service worker for PWA functionality
serviceWorkerRegistration.register();