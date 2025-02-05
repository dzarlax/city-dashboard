import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export const baseConfig = {
  plugins: [react()],
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
}; 