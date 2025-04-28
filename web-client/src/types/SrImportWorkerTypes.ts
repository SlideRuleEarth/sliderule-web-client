// src/workers/SrImportWorkerTypes.ts

export interface ImportWorkerRequest {
    fileName: string;            // original file name (for logging/debugging)
    newFileName?: string;        // optional final file name (used if provided)
    fileBuffer: ArrayBuffer;     // binary content of the uploaded file
}

export interface ImportWorkerResponse {
    status: 'success' | 'error';
    fileName?: string;
    message?: string;
}
