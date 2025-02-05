import { defineConfig } from 'vite';
import { baseConfig } from './vite.config.base';

const isHACS = process.env.HACS === 'true';
const base = isHACS ? '/local/community/city_dashboard/' : '/';

export default defineConfig({
  ...baseConfig,
  base: base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: 'src/client/ha-panel.jsx',
      output: {
        entryFileNames: 'dashboard.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Все ассеты кроме JS помещаем в assets
          if (!assetInfo.name.endsWith('.js')) {
            return 'assets/[name][extname]';
          }
          return '[name][extname]';
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.PUBLIC_URL': JSON.stringify(base),
  },
});