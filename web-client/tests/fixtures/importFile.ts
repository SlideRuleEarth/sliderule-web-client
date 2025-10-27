// fixtures/importFile.ts
import { test as skipIntroTest } from './skipIntroTour';
import { type Page, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@/utils/logger';

const logger = createLogger('importFile');

export const test = skipIntroTest.extend<{
    pageAfterImport: Page;
}>({
    pageAfterImport: async ({ pageAfterTour, browserName }, use) => {
        await pageAfterTour.getByRole('button', { name: 'Records' }).click();
        await pageAfterTour.getByRole('button', { name: 'Import' }).click();

        const fileName = 'atl03x-surface_TestParquetFile_001.parquet';

        if (browserName === 'webkit') {
            logger.warn('WebKit: Fetching and injecting file into OPFS from static test server');
            try {
                await pageAfterTour.evaluate(async (fileName) => {
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
                logger.error('WebKit: Failed to inject file', { fileName, error: error instanceof Error ? error.message : String(error) });
                throw new Error(`Failed to inject file: ${fileName} - ${error}`);
            }
            logger.debug('WebKit: Successfully injected file into OPFS', { fileName });
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
