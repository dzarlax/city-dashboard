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
    // Change base to match Home Assistant's serving path
    base: '/local/city_dashboard/',
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Ensure assets are properly named and located
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js'
      }
    }
  }
})