// playwright.config.mts
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const env = process.env.ENV || 'local';
const envPath = path.join(ROOT, `.env.${env}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment: ${env}`);
} else {
  throw new Error(`❌ Missing .env file: ${envPath}`);
}

export default defineConfig({
  // Only look under tests/e2e
  testDir: path.resolve(__dirname, 'tests/e2e'),
  testMatch: /.*\.e2e\.(spec|test)\.(ts|js|mjs|cjs)$/,

  // Belt & suspenders: if someone moves things around, still ignore unit
  testIgnore: ['**/unit/**', '**/*.vitest.*'],

  reporter: [['html', { outputFolder: path.resolve(__dirname, 'playwright-report'), open: 'never' }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],

  webServer: {
    command: 'make -s build && npm --prefix web-client run preview -- --port=5173 --strictPort',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    cwd: ROOT,
    timeout: 120_000,
  },
});
