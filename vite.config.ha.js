import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const isHACS = process.env.HACS === 'true';

export default defineConfig({
  plugins: [react()],
  base: isHACS ? '/hacsfiles/city_dashboard/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: 'src/client/ha-panel.jsx',
      output: {
        entryFileNames: 'dashboard.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    cssCodeSplit: false,
    cssMinify: true,
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            './src/client/**/*.{js,jsx}',
            './src/client/**/*.css',
          ],
        }),
        autoprefixer(),
      ],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.PUBLIC_URL': JSON.stringify('/hacsfiles/city_dashboard'),
  },
});