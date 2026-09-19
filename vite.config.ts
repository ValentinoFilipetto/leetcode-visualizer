import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages friendly: set BASE_PATH=/repo-name/ when deploying to a project page.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', sourcemap: false },
});
