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
    rollupOptions: {
      input: {
        'card': 'src/client/city-dashboard-card.js',
        'editor': 'src/client/card-editor.js'
      },
      output: {
        entryFileNames: '[name].js',
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