import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    createHtmlPlugin({})
  ],
  server: {
    hmr: {
      overlay: false // disable overlay to reduce rendering load on reloads
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    sourcemap: process.env.VITE_BUILD_SOURCEMAP === 'true' // conditionally Enable source maps for production build
  },
  optimizeDeps: {
    include: ['@duckdb/duckdb-wasm'] // Explicitly pre-bundle any large dependencies you suspect might be slow
  }
})
