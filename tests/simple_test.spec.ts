import { test, expect } from '@playwright/test';
test.skip(({ browserName }) => browserName === 'webkit', 'Workers not supported in Playwright WebKit');

test.beforeEach(async ({ page }) => {

    await page.goto('https://client.slideruleearth.io/');
    await page.getByText('Welcome to SlideRule Earth!').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Step 1: Zoom In').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Step 2: Select a draw tool').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Step 3: Draw a region').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Step 4: Run SlideRule').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('That\'s it!').click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
});

test('test', async ({ page }) => {
    await page.getByRole('button', { name: '🔍' }).click();
    await page.getByRole('textbox', { name: 'Search for' }).fill('Goddard Space Flight Center');
    await page.getByRole('textbox', { name: 'Search for' }).press('Enter');
    await page.getByTitle('Draw a Rectangle by clicking').getByRole('img').click();
    //await page.pause();
    const canvas = page.locator('canvas').nth(1);
    const box = await canvas.boundingBox();

    if (!box) {
        throw new Error('Canvas bounding box not found. Make sure the canvas is visible.');
    }
    await page.getByText('+').click();
    await page.getByText('+').click();
    await page.getByText('+').click(); // Zoom in to ensure the canvas is large enough for interaction

    //debugger;

    const startX = 575, startY = 350;
    const endX = 500, endY = 325;

    // 1. Move to the starting point (no click yet)
    await page.mouse.move(box.x + startX, box.y + startY);

    // 2. Mouse down (start "drag")
    await page.mouse.down();

    // 3. Move to the ending point ("drag")
    await page.mouse.move(box.x + endX, box.y + endY, { steps: 10 });

    // 4. Mouse up (release, finish drag)
    await page.mouse.up();

    // Click "Run SlideRule"
    await page.getByRole('button', { name: ' Run SlideRule' }).click();

    // Wait for navigation (optional, depends on app behavior)
    await page.waitForURL('**/analyze/1', { timeout: 180000 }); // waits up to 3 minutes

    //await page.pause();
    //debugger;
    await expect(page.getByLabel('1 - atl06p', { exact: true }).getByLabel('h_mean', { exact: true })).toMatchAriaSnapshot(`- combobox "h_mean"`);

});
test.setTimeout(180000); // Set timeout to 3 minutes for the test
