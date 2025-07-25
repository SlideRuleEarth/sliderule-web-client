// sliderule-web-client/playwright.config.ts
// This file is used to configure Playwright for end-to-end testing of the SlideRule Earth web client.
// It sets up the test environment, including browser configurations, test directories, and environment variables
// sliderule-web-client/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment-specific .env file
const env = process.env.ENV || 'local';
const envPath = `.env.${env}`;

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

    webServer: [
        {
            command: 'npm run dev',
            port: 5173,
            cwd: path.resolve(__dirname, 'web-client'),
            timeout: 60 * 1000,
            reuseExistingServer: !process.env.CI,
        },
        // {
        //     command: 'npx serve tests/data -l 5174',
        //     port: 5174,
        //     cwd: path.resolve(__dirname),
        //     timeout: 10 * 1000,
        //     reuseExistingServer: true,
        // }
    ],
});
