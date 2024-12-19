import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import envCompatible from 'vite-plugin-env-compatible'; // Добавлен импорт плагина

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), envCompatible()],
});