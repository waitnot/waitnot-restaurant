import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rename-captain-html',
      closeBundle() {
        // Rename index-captain.html → index.html so Capacitor finds it
        try {
          copyFileSync(
            resolve(__dirname, 'dist-captain/index-captain.html'),
            resolve(__dirname, 'dist-captain/index.html')
          );
        } catch {}
      }
    }
  ],
  build: {
    outDir: 'dist-captain',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index-captain.html'),
    },
  },
  resolve: { alias: { '@': '/src' } },
  publicDir: 'public',
});
