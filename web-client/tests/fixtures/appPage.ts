// fixtures/appPage.ts
import { test as base, type Page } from '@playwright/test'

// The request view with its map controls rendered. Nothing opens by itself
// on a first visit (issue #1088), so there is nothing to dismiss.
export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await page.goto('/') // baseURL handles full path
    await page.locator('.sr-run-abort-button').waitFor()

    await use(page)
  }
})
