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
    sourcemap: process.env.VITE_BUILD_SOURCEMAP === 'true', // conditionally enable source maps for production build
    rollupOptions: {
		output: {
			manualChunks(id) {
			// Ensure @luma.gl/webgl and @deck.gl/core are in the same chunk
			if (id.includes('@luma.gl/webgl') || id.includes('@deck.gl/core')) {
				return 'deckgl-bundle';
			}
			// Group large dependencies together
			if (id.includes('@duckdb/duckdb-wasm')) {
				return 'duckdb-bundle';
			}
			// Separate node_modules into a common vendor chunk
			if (id.includes('node_modules')) {
				return 'vendor';
			}
			return null;
			}
		}
		}
	},
  	optimizeDeps: {
    	include: ['@duckdb/duckdb-wasm'] // Explicitly pre-bundle large dependencies
  	}
})
