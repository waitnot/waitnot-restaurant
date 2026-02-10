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
            target: 'http://localhost:5000',
            changeOrigin: true
          }
        }
      })
    },
    build: {
      target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      polyfillModulePreload: true,
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['lucide-react', 'recharts'],
            utils: ['axios', 'socket.io-client'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector']
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        },
        // Handle extension-related module loading errors
        onwarn(warning, warn) {
          // Suppress warnings from Chrome extensions
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && 
              warning.message.includes('chrome-extension://')) {
            return;
          }
          warn(warning);
        }
      }
    },
    define: {
      global: 'globalThis'
    },
    // Additional configuration to handle extension conflicts
    optimizeDeps: {
      exclude: ['chrome-extension'],
      include: ['react', 'react-dom', 'react-router-dom', 'axios']
    },
    resolve: {
      alias: {
        // Prevent extension module conflicts
        'chrome-extension': false
      }
    }
  }
})
