import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import envCompatible from 'vite-plugin-env-compatible'

const isHACS = process.env.HACS === 'true';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [react(), envCompatible()],
  build: {
    outDir: isHACS ? 'www/community/city_dashboard' : 'dist',
    emptyOutDir: true,
    base: isHACS ? '/hacsfiles/city_dashboard/' : '/',  // ✅ Устанавливаем корректный base
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        dashboard: 'src/client/main.jsx'
      },
      external: ['react', 'react-dom'], // ✅ Исключаем React, чтобы избежать дублирования
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        entryFileNames: isDev ? '[name].js' : 'dashboard.js',
        assetFileNames: 'assets/[name].[ext]',  // ✅ Исправленный путь для ассетов
        chunkFileNames: 'assets/[name].js'      // ✅ Исправленный путь для чанков
      }
    }
  }
});