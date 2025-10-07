// src/workers/SrImportWorkerTypes.ts

export interface ImportWorkerRequest {
  fileName: string;
  newFileName: string;
  file?: File;
  fileSize?: number;
}

export type ImportWorkerControl =
  | { type: 'cancel' }           //  cancel the streaming copy
  | { type: 'ping' };            // optional, can ignore

export type ImportWorkerProgress = { progress: number }; // 0..100

export type ImportWorkerResponse =
  | { status: 'ok'; newFileName: string }
  | { status: 'aborted'; newFileName: string }          //  user aborted
  | { status: 'error'; message: string; newFileName?: string };
