import { defineConfig } from 'vite';
import envCompatible from 'vite-plugin-env-compatible';
import { baseConfig } from './vite.config.base';

// https://vite.dev/config/
export default defineConfig({
  ...baseConfig,
  plugins: [...baseConfig.plugins, envCompatible()],
  server: {
    host: true,
    port: 3000,
  },
  base: '/',
});