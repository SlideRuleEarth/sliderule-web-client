import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // alias for "@/..."
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'], // unit specs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit/SrExportDialog.spec.ts', // TODO: Re-enable when CSS import issue is resolved
    ],
    // you can add: setupFiles: ['tests/setup/unit.setup.ts'] if you move polyfills out
  },
});
