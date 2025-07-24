import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://testsliderule.org/');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Records' }).click();
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('button', { name: 'Import' }).setInputFiles('TestParquetFile_001.parquet');
});