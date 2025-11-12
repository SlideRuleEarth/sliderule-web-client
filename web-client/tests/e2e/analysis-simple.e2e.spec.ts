import { test } from '../fixtures/importFile'
import { expect } from '@playwright/test' // ✅ import expect from Playwright

test('imports file and loads analysis view', async ({ pageAfterImport }) => {
  // Go directly to /analyze/1
  await pageAfterImport.goto('/analyze/1')

  // Perform some assertions or interactions
  // Wait for the ECharts wrapper to appear
  const chartWrapper = pageAfterImport.locator('x-vue-echarts.scatter-chart')
  //await expect(chartWrapper).toBeVisible({ timeout: 15000 }); // Increase to 15s
  await pageAfterImport.waitForSelector('x-vue-echarts.scatter-chart', { timeout: 15000 })
  await expect(chartWrapper).toBeVisible()
  // Check that it contains at least one canvas (ECharts uses 2 for layering)
  const canvases = chartWrapper.locator('canvas')
  await expect(canvases).toHaveCount(2) // or `>= 1` if needed

  // Optionally check dimensions
  const box = await canvases.first().boundingBox()
  expect(box?.width).toBeGreaterThan(100)
  expect(box?.height).toBeGreaterThan(100)
})
