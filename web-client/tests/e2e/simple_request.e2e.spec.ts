import { test } from '../fixtures/skipIntroTour'
import { expect } from '@playwright/test'

// skip for WebKit as it does not support workers
test.skip(
  ({ browserName }) => browserName === 'webkit',
  'Workers not supported in Playwright WebKit'
)

// Skip if running in local dev mode
test.skip(Boolean(process.env.LOCAL_DEV), 'Skipping in local dev environment')

test('layer switcher is visible on map', async ({ pageAfterTour }) => {
  const page = pageAfterTour

  // Wait for the map to load
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Check that the layer switcher control is present (ol-ext uses ol-layerswitcher class)
  const layerSwitcher = page.locator('.ol-control.ol-layerswitcher')
  await expect(layerSwitcher).toBeVisible({ timeout: 5000 })

  // Check that the layer switcher button is present
  const layerSwitcherButton = layerSwitcher.locator('button')
  await expect(layerSwitcherButton).toBeVisible()

  // The control should have the ol-collapsed class initially (collapsed by default)
  await expect(layerSwitcher).toHaveClass(/ol-collapsed/)

  // Verify the panel is initially hidden (control is collapsed)
  const panel = layerSwitcher.locator('.panel')
  await expect(panel).toBeHidden()
})

test('draw rectangle and run SlideRule', async ({ pageAfterTour }) => {
  const page = pageAfterTour

  await page.getByRole('button', { name: '🔍' }).click()
  await page.getByRole('textbox', { name: 'Search for' }).fill('Goddard Space Flight Center')
  await page.getByRole('textbox', { name: 'Search for' }).press('Enter')

  await page.getByTitle('Draw a Rectangle by clicking').getByRole('img').click()

  const canvas = page.locator('canvas').nth(1)
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Canvas bounding box not found. Make sure the canvas is visible.')
  }

  // Zoom in
  //await page.getByText('+').click();
  await page.waitForTimeout(1500) // wait for the map to stabilize
  // Draw rectangle
  const startX = 575,
    startY = 350
  const endX = 500,
    endY = 325

  await page.mouse.move(box.x + startX, box.y + startY)
  await page.mouse.down()
  await page.mouse.move(box.x + endX, box.y + endY, { steps: 10 })
  await page.mouse.up()

  await page.getByRole('button', { name: ' Run SlideRule' }).click()
  await page.waitForURL('**/analyze/1', { timeout: 180000 })

  await expect(
    page.getByLabel('1 - atl03x-surface', { exact: true }).getByLabel('h_mean', { exact: true })
  ).toMatchAriaSnapshot(`- combobox "h_mean"`, { timeout: 60000 })
})

test.setTimeout(180000)
