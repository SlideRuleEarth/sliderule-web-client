import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // alias for "@/..."
      // Mock CSS imports from problematic modules
      'ol-contextmenu/dist/ol-contextmenu.css': path.resolve(__dirname, 'tests/setup/css-stub.ts')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'], // unit specs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit/SrExportDialog.spec.ts' // TODO: Re-enable when CSS import issue is resolved
    ],
    setupFiles: ['tests/setup/unit.setup.ts'],
    deps: {
      optimizer: {
        web: {
          include: ['ol-contextmenu']
        }
      }
    }
  }
})
