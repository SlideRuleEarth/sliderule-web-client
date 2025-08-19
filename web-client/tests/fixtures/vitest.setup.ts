// Minimal globals used by your unit tests in Node env

// Polyfill File in Node if missing
if (typeof globalThis.File === 'undefined') {
  class NodeFile extends Blob {
    name: string;
    lastModified: number;
    constructor(parts: BlobPart[], name: string, opts?: FilePropertyBag) {
      super(parts, opts);
      this.name = name;
      this.lastModified = opts?.lastModified ?? Date.now();
    }
  }
  // @ts-expect-error attach to global
  globalThis.File = NodeFile;
}

// Node 18+ usually has fetch/Response from Undici already.
// If your environment doesn't, uncomment this block:
//
// try {
//   const { fetch, Response, Headers, Request } = await import('undici');
//   if (!globalThis.fetch) globalThis.fetch = fetch as any;
//   if (!globalThis.Response) globalThis.Response = Response as any;
//   if (!globalThis.Headers) globalThis.Headers = Headers as any;
//   if (!globalThis.Request) globalThis.Request = Request as any;
// } catch {}
