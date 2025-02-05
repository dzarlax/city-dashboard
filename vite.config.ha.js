import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import envCompatible from 'vite-plugin-env-compatible';

const isHACS = process.env.HACS === 'true';

export default defineConfig({
  plugins: [react(), envCompatible()],
  base: isHACS ? '/hacsfiles/city_dashboard/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        dashboard: 'src/client/main.jsx',
      },
      output: {
        entryFileNames: 'dashboard.js',
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});