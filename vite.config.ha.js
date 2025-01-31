import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import envCompatible from 'vite-plugin-env-compatible';

const isHACS = process.env.HACS === 'true';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [react(), envCompatible()],
  base: isHACS ? '/hacsfiles/city_dashboard/' : '/',  // ✅ Указываем базовый путь для HACS
  build: {
    outDir: isHACS ? 'www/community/city_dashboard' : 'dist', // ✅ Гарантируем правильный выходной каталог
    emptyOutDir: true,
    assetsDir: 'assets',  // ✅ Все ассеты (CSS, JS) будут в /assets/
    rollupOptions: {
      input: {
        dashboard: 'src/client/main.jsx',
      },
      external: [], // ✅ React не включается в сборку, т.к. Home Assistant его подгружает
      output: {
        globals: {
        },
        entryFileNames: 'dashboard.js',  // ✅ Главный JS-файл
        assetFileNames: 'assets/[name].[ext]',  // ✅ CSS и шрифты идут в /assets/
        chunkFileNames: 'assets/[name].js',  // ✅ Чанки также в /assets/
      },
    },
  },
});