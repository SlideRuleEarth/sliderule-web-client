import { test } from '../fixtures/skipIntroTour';
import { expect } from '@playwright/test';

// skip for WebKit as it does not support workers
test.skip(({ browserName }) => browserName === 'webkit', 'Workers not supported in Playwright WebKit');

// Skip if running in local dev mode
test.skip(Boolean(process.env.LOCAL_DEV), 'Skipping in local dev environment');

test('draw rectangle and run SlideRule', async ({ pageAfterTour }) => {
    const page = pageAfterTour;

    await page.getByRole('button', { name: '🔍' }).click();
    await page.getByRole('textbox', { name: 'Search for' }).fill('Goddard Space Flight Center');
    await page.getByRole('textbox', { name: 'Search for' }).press('Enter');

    await page.getByTitle('Draw a Rectangle by clicking').getByRole('img').click();

    const canvas = page.locator('canvas').nth(1);
    const box = await canvas.boundingBox();

    if (!box) {
        throw new Error('Canvas bounding box not found. Make sure the canvas is visible.');
    }

    // Zoom in
    await page.getByText('+').click();
    await page.getByText('+').click();
    await page.getByText('+').click();

    // Draw rectangle
    const startX = 575, startY = 350;
    const endX = 500, endY = 325;

    await page.mouse.move(box.x + startX, box.y + startY);
    await page.mouse.down();
    await page.mouse.move(box.x + endX, box.y + endY, { steps: 10 });
    await page.mouse.up();

    await page.getByRole('button', { name: ' Run SlideRule' }).click();
    await page.waitForURL('**/analyze/1', { timeout: 180000 });

    await expect(
        page.getByLabel('1 - atl03x-surface', { exact: true }).getByLabel('h_mean', { exact: true })
    ).toMatchAriaSnapshot(`- combobox "h_mean"`);
});

test.setTimeout(180000);
