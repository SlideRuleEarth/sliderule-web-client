/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // shared settings/plugins/aliases (inherited by projects when extends: true)
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },

  test: {
    // global toggles that apply to all projects unless overridden
    globals: true,

    // ✅ coverage is root-level (not inside a project)
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage', // root dir; projects can still write there (or split by reporter)
      reporter: ['text', 'html', 'lcov'],
    },

    // ✅ v3 way: define multiple projects here
    projects: [
      {
        // inherit root options (resolve/globals/coverage)
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.spec.{ts,tsx}'],
          exclude: ['tests/e2e/**'],
          setupFiles: ['tests/fixtures/vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/**/*.spec.{ts,tsx}'],
          exclude: ['tests/unit/**', 'tests/e2e/**'],
          setupFiles: ['tests/fixtures/vitest.setup.ts'],
        },
      },
    ],
  },
});
