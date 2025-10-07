// src/workers/SrImportWorker.ts
import type {
  ImportWorkerRequest,
  ImportWorkerResponse,
  ImportWorkerControl
} from '@/types/SrImportWorkerTypes';

declare const self: DedicatedWorkerGlobalScope;

let current: {
  dir?: FileSystemDirectoryHandle;
  fh?: FileSystemFileHandle;
  writable?: FileSystemWritableFileStream;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  newFileName?: string;
  aborted?: boolean;
} = {};

self.onmessage = async (e: MessageEvent<ImportWorkerRequest | ImportWorkerControl>) => {
  const data = e.data as any;

  // --- Control channel: cancel ---
  if (data?.type === 'cancel') {
    try {
      current.aborted = true;
      // Stop reading ASAP
      await current.reader?.cancel().catch(() => {});
      // Discard any buffered write
      await current.writable?.abort?.().catch(() => {});
      // Remove partial file
      if (current.dir && current.newFileName) {
        await current.dir.removeEntry(current.newFileName).catch(() => {});
      }
    } finally {
      self.postMessage(<ImportWorkerResponse>{
        status: 'aborted',
        newFileName: current.newFileName || ''
      });
    }
    return;
  }

  // --- Normal copy request ---
  const { file, newFileName, fileSize = 0 } = data as ImportWorkerRequest;
  if (!newFileName) {
    self.postMessage(<ImportWorkerResponse>{ status: 'error', message: 'Missing target filename' });
    return;
  }
  if (!file) {
    self.postMessage(<ImportWorkerResponse>{ status: 'error', message: 'No file or stream provided' });
    return;
  }

  current = { aborted: false, newFileName };

  try {
    const root = await (navigator as any).storage.getDirectory();
    const dir = await root.getDirectoryHandle('SlideRule', { create: true });
    const fh  = await dir.getFileHandle(newFileName, { create: true });
    const writable = await fh.createWritable();

    current.dir = dir;
    current.fh = fh;
    current.writable = writable;

    const START = 10, END = 80, span = END - START;
    const total = fileSize || file.size || 0;
    let written = 0;

    const reader = file.stream().getReader();
    current.reader = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        await writable.write(value);
        written += value.byteLength;

        if (total > 0) {
          const p = START + (written / total) * span;
          self.postMessage({ progress: Math.min(END, p) });
        }
        if (current.aborted) throw new Error('aborted');
      }
      // Commit only if not aborted
      await writable.close();
      self.postMessage(<ImportWorkerResponse>{ status: 'ok', newFileName });
    } catch (inner) {
      // If canceled or failed mid-stream, discard and remove partial
      await writable.abort?.().catch(() => {});
      if (dir) await dir.removeEntry(newFileName).catch(() => {});
      if (current.aborted) {
        self.postMessage(<ImportWorkerResponse>{ status: 'aborted', newFileName });
      } else {
        self.postMessage(<ImportWorkerResponse>{
          status: 'error',
          message: (inner as any)?.message || String(inner),
          newFileName
        });
      }
    } finally {
      reader.releaseLock?.();
    }
  } catch (err: any) {
    // Setup failure (directory/file handle, etc.)
    try {
      await current.writable?.abort?.();
      if (current.dir && current.newFileName) {
        await current.dir.removeEntry(current.newFileName).catch(() => {});
      }
    } finally {
      self.postMessage(<ImportWorkerResponse>{
        status: 'error',
        message: err?.message || String(err),
        newFileName
      });
    }
  } finally {
    current = {};
  }
};
