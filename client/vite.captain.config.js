import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-captain',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index-captain.html'),
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  publicDir: 'public',
});
