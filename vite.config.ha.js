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
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    cssInject: true, // Встраиваем CSS в JS
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.PUBLIC_URL': JSON.stringify(base),
  },
});