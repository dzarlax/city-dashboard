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
    base: '/local/city_dashboard/',
    rollupOptions: {
      input: {
        dashboard: 'src/main.jsx' // Указываем точку входа для dashboard.js
      },
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'dashboard.js'  // ✅ Теперь dashboard.js всегда будет в dist/
      }
    }
  }
})