import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'
import path from 'path'

const isHACS = process.env.HACS === 'true';

export default defineConfig({
  plugins: [
    react(),
    envCompatible()
  ],
  build: {
    outDir: isHACS 
      ? 'custom_components/city_dashboard/frontend/dist' 
      : 'www/community/city_dashboard',
    emptyOutDir: true,
    base: isHACS ? '/local/city_dashboard/' : '/hacsfiles/city_dashboard/',
    rollupOptions: {
      input: {
        dashboard: 'src/client/main.jsx'
      },
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'dashboard.js'
      }
    }
  }
})