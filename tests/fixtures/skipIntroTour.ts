// fixtures/skipIntroTour.ts
import { test as base, type Page } from '@playwright/test';


export const test = base.extend<{ pageAfterTour: Page }>({
    pageAfterTour: async ({ page }, use) => {
        await page.goto('/'); // baseURL handles full path

        await page.getByText('Welcome to SlideRule Earth!').click();

        for (let step of [
            'Step 1: Zoom In',
            'Step 2: Select a draw tool',
            'Step 3: Draw a region',
            'Step 4: Run SlideRule',
            "That's it!",
        ]) {
            await page.getByRole('button', { name: 'Next' }).click();
            await page.getByText(step).click();
        }

        await page.getByRole('button', { name: 'Done' }).click();
        await page.getByRole('button', { name: 'Close' }).click();

        await use(page);
    },
});
