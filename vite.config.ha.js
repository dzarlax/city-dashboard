import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'

export default defineConfig({
  plugins: [
    react(),
    envCompatible()
  ],
  build: {
    outDir: 'custom_components/city_dashboard/frontend/dist',
    emptyOutDir: true,
    base: '/hacsfiles/city-dashboard/',
  }
})