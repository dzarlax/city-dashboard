import Dashboard from './Dashboard.jsx'
import { LocalizationProvider } from './utils/LocalizationContext.jsx'

function App() {
  return (
    <LocalizationProvider>
      <Dashboard />
    </LocalizationProvider>
  )
}

export default App