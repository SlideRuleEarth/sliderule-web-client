// fixtures/importFile.ts
import { test as skipIntroTest } from './skipIntroTour';
import { type Page, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const test = skipIntroTest.extend<{
    pageAfterImport: Page;
}>({
    pageAfterImport: async ({ pageAfterTour, browserName }, use) => {
        await pageAfterTour.getByRole('button', { name: 'Records' }).click();
        await pageAfterTour.getByRole('button', { name: 'Import' }).click();

        const fileName = 'atl06_TestParquetFile_001.parquet';

        if (browserName === 'webkit') {
            console.warn('[WebKit] Fetching and injecting file into OPFS from static test server');
            try {
                await pageAfterTour.evaluate(async (fileName) => {
                    console.log('Fetching', fileName)
                    const response = await fetch(`http://127.0.0.1:5174/${fileName}`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${fileName} from test server`);
                    }
                    const buf = await response.arrayBuffer();
                    const root = await navigator.storage.getDirectory();
                    const fh = await root.getFileHandle(fileName, { create: true });
                    const writable = await fh.createWritable();
                    await writable.write(buf);
                    await writable.close();
                }, fileName);
            } catch (error) {
                console.error(`[WebKit] Failed to inject file: ${fileName}`, error);
                throw new Error(`Failed to inject file: ${fileName} - ${error}`);
            }
            console.log(`[WebKit] Successfully injected file: ${fileName} into OPFS`);
        } else {
            const filePath = fileURLToPath(new URL(`../data/${fileName}`, import.meta.url));
            const fileInput = pageAfterTour.locator('input[type="file"]');
            await fileInput.setInputFiles(filePath);

            const toast = pageAfterTour.getByRole('alert').filter({ hasText: 'Import Complete' });
            await expect(toast).toBeVisible({ timeout: 10000 });
        }

        await use(pageAfterTour);
    },
});
