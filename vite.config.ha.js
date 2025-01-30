import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'

const isHACS = process.env.HACS === 'true';

export default defineConfig({
  plugins: [react(), envCompatible()],
  build: {
    outDir: 'www/community/city_dashboard', // Всегда билдим в нужную папку
    emptyOutDir: true,
    base: '/hacsfiles/city_dashboard/',
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