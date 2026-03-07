import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const swCacheVersionPlugin = () => ({
  name: 'sw-cache-version',
  closeBundle() {
    const swPath = resolve('dist', 'sw-custom.js');
    if (!existsSync(swPath)) return;
    const hash = Date.now().toString(36);
    const version = `city-dashboard-${hash}`;
    let content = readFileSync(swPath, 'utf-8');
    content = content.replace('__SW_CACHE_VERSION__', version);
    writeFileSync(swPath, content);
    console.log(`[sw-cache-version] Cache version: ${version}`);
  }
});

export const baseConfig = {
  plugins: [react(), swCacheVersionPlugin()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
};
