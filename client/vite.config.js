import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development';
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      // Only use proxy in development mode
      ...(isDev && {
        proxy: {
          '/api': {
            target: 'https://waitnot-restaurant.onrender.com',
            changeOrigin: true
          }
        }
      })
    },
    build: {
      target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      polyfillModulePreload: true,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom']
          }
        }
      }
    },
    define: {
      global: 'globalThis'
    }
  }
})
