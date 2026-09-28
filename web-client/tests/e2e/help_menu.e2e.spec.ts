import { test } from '../fixtures/appPage'
import { expect } from '@playwright/test'

// Issue #1088: nothing advice-like opens on its own; help lives in the Help menu

test('first visit shows no tour or tips, and the Help button pulses', async ({ appPage }) => {
  const page = appPage

  await expect(page.getByText('Welcome to SlideRule Earth!')).toHaveCount(0)
  await expect(page.locator('.p-toast-message-info')).toHaveCount(0)
  await expect(page.locator('#sr-help-button')).toHaveClass(/sr-help-pulse/)
})

test('Help → Quick Tour runs the tour and stops the pulse', async ({ appPage }) => {
  const page = appPage
  const helpButton = page.locator('#sr-help-button')

  await helpButton.click()
  await page.getByRole('menuitem', { name: 'Quick Tour' }).click()

  await page.getByText('Welcome to SlideRule Earth!').click()
  for (const step of [
    'Step 1: Zoom In',
    'Step 2: Select a draw tool',
    'Step 3: Draw a region',
    'Step 4: Run SlideRule',
    "That's it!"
  ]) {
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByText(step).click()
  }
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(helpButton).not.toHaveClass(/sr-help-pulse/)

  await page.reload()
  await page.locator('.sr-run-abort-button').waitFor()
  await expect(page.locator('#sr-help-button')).not.toHaveClass(/sr-help-pulse/)
  await expect(page.getByText('Welcome to SlideRule Earth!')).toHaveCount(0)
})
