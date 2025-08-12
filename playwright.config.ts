// sliderule-web-client/playwright.config.ts
// This file is used to configure Playwright for end-to-end testing of the SlideRule Earth web client.
// It sets up the test environment, including browser configurations, test directories, and environment variables
// sliderule-web-client/playwright.config.ts
// playwright.config.ts (at repo root)
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = process.env.ENV || 'local';
const envPath = path.resolve(__dirname, `.env.${env}`);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment: ${env}`);
} else {
  throw new Error(`❌ Missing .env file: ${envPath}`);
}

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },
    ],

    webServer: {
        command: 'npm run build && npm run preview -- --port=5173',
        port: 5173,
        reuseExistingServer: !process.env.CI
    },
   
});
