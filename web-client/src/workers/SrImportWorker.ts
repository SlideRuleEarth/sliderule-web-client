// src/workers/SrImportWorker.ts
import type { ImportWorkerRequest, ImportWorkerResponse } from '@/types/SrImportWorkerTypes';

self.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
    const { fileName, newFileName, fileBuffer } = event.data;
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const folderHandle = await opfsRoot.getDirectoryHandle('SlideRule', { create: true });

        const finalFileName = newFileName || fileName;

        const fileHandle = await folderHandle.getFileHandle(finalFileName, { create: true });
        const syncAccessHandle = await (fileHandle as any).createSyncAccessHandle();

        const buffer = new Uint8Array(fileBuffer);
        const totalBytes = buffer.byteLength;
        const chunkSize = 1024 * 1024; // 1MB chunks
        let offset = 0;

        while (offset < totalBytes) {
            const end = Math.min(offset + chunkSize, totalBytes);
            const chunk = buffer.subarray(offset, end);
            const written = await syncAccessHandle.write(chunk, { at: offset });
            if (written !== chunk.length) {
                throw new Error(`Failed to write full chunk at offset ${offset}`);
            }
            offset = end;

            const progress = (offset / totalBytes) * 100;
            self.postMessage({ progress });
        }

        await syncAccessHandle.flush();
        await syncAccessHandle.close();

        const response: ImportWorkerResponse = { status: 'success', fileName: finalFileName };
        self.postMessage(response);
    } catch (error) {
        console.error('Worker Error:', error);
        const response: ImportWorkerResponse = { status: 'error', message: String(error) };
        self.postMessage(response);
    }
};
