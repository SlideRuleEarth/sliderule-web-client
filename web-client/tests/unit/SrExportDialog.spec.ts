// tests/unit/SrExportDialog.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SrExportDialog from '@/components/SrExportDialog.vue';
import { nextTick } from 'vue';


// ---------- Polyfills & globals (ESM-safe) ----------
let Readable = globalThis.ReadableStream as any;
let Writable = globalThis.WritableStream as any;

if (!Readable || !Writable) {
  const mod = await import('node:stream/web');
  Readable ||= (mod as any).ReadableStream;
  Writable ||= (mod as any).WritableStream;
}
(globalThis as any).ReadableStream = Readable;
(globalThis as any).WritableStream = Writable;

if (!globalThis.TextEncoder) {
  const { TextEncoder } = await import('node:util');
  (globalThis as any).TextEncoder = TextEncoder;
}

const clickSpy = vi.fn();
const realCreateElement = Document.prototype.createElement;
vi.spyOn(document, 'createElement').mockImplementation(function (this: Document, tag: any) {
  const el = realCreateElement.call(this, tag);
  if (tag === 'a') (el as any).click = clickSpy;
  return el;
});

// Robust URL polyfill (jsdom may not have these)
const gURL: any = (globalThis as any).URL || {};
if (typeof gURL.createObjectURL !== 'function') {
  gURL.createObjectURL = vi.fn(() => 'blob://fake');
} else {
  vi.spyOn(gURL, 'createObjectURL').mockReturnValue('blob://fake');
}
if (typeof gURL.revokeObjectURL !== 'function') {
  gURL.revokeObjectURL = vi.fn(() => {});
} else {
  vi.spyOn(gURL, 'revokeObjectURL').mockImplementation(() => {});
}
(globalThis as any).URL = gURL;

// OPFS polyfill bits used by exportParquet
const fakeFile = (chunks: BlobPart[] = []) => {
  const safeChunks = chunks.map(p => (p instanceof Uint8Array ? p.slice() : p));
  const blob = new Blob(safeChunks, { type: 'application/octet-stream' });
  return new File([blob], 'file.parquet', { type: 'application/octet-stream' });
};
const fakeReadableWithPipeTo = () => {
  const rs: any = {
    pipeTo: vi.fn().mockResolvedValue(undefined),
    getReader: vi.fn(() => ({
      read: vi.fn().mockResolvedValue({ done: true, value: undefined })
    }))
  };
  return rs;
};

// ---------- Hoisted fns for mocks (avoid "before initialization") ----------
const {
  dbGetFilename,
  duckInsert,
  duckRowCount,
  duckCols,
  duckQuery,
  parquetCfgGet,
  parquetCfgSet,
  srcIdSet,
  toastAdd,
} = vi.hoisted(() => ({
  dbGetFilename: vi.fn(),
  duckInsert: vi.fn(),
  duckRowCount: vi.fn(),
  duckCols: vi.fn(),
  duckQuery: vi.fn(),
  parquetCfgGet: vi.fn(),
  parquetCfgSet: vi.fn(),
  srcIdSet: vi.fn(),
  toastAdd: vi.fn(),
}));

// ---------- Module mocks ----------
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd }) // shared spy
}));

vi.mock('@/db/SlideRuleDb', () => ({
  db: { getFilename: dbGetFilename }
}));

vi.mock('@/utils/SrDuckDb', () => ({
  createDuckDbClient: vi.fn().mockResolvedValue({
    insertOpfsParquet: duckInsert,
    getTotalRowCount: duckRowCount,
    queryForColNames: duckCols,
    query: duckQuery
  })
}));

vi.mock('@/stores/srParquetCfgStore', () => ({
  useSrParquetCfgStore: () => ({
    getSelectedExportFormat: parquetCfgGet,
    setSelectedExportFormat: parquetCfgSet
  })
}));

vi.mock('@/utils/fetchUtils', () => ({
  getFetchUrlAndOptions: vi.fn().mockResolvedValue({
    url: '/fake/export',
    options: { body: JSON.stringify({ ok: true }), headers: {} }
  })
}));

vi.mock('@/stores/srcIdTblStore', () => ({
  useSrcIdTblStore: () => ({
    setSrcIdTblWithFileName: srcIdSet,
    sourceTable: { 42: 'granule-xyz' } // lookup for CSV mapping
  })
}));

// ---------- PrimeVue component stubs ----------
const stubs = {
  Dialog: {
    template: `<div><slot name="header"></slot><slot></slot><slot name="footer"></slot></div>`,
    props: ['visible']
  },
  Select: {
    template: `
      <select data-testid="formatSelect" :value="modelValue"
              @change="$emit('update:modelValue', $event.target.value)">
        <option value="csv">csv</option>
        <option value="parquet">parquet</option>
        <option value="geoparquet">geoparquet</option>
      </select>`,
    // 👇 IMPORTANT: consume these so they don't end up on the DOM element
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder', 'id']
  },
  Button: {
    template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>`,
    props: ['label', 'disabled', 'class']
  },
  ProgressSpinner: { template: `<div data-testid="spinner"></div>` }
};
// ---------- Test utils ----------
const mountDialog = (props: any = {}) =>
  mount(SrExportDialog, {
    props: { reqId: 1, modelValue: true, ...props },
    global: { stubs }
  });

// Flush a cycle of microtasks + timers
const flush = async () => {
  // microtasks
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();

  // vitest timers (we enabled fake timers in beforeEach)
  await vi.runAllTicks();
  vi.runAllTimers();
};

// Repeatedly flush until a predicate is true (or timeout)
// Repeatedly flush until predicate is true (or give up after N tries)
const flushUntil = async (predicate: () => boolean, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    await flush();
    if (predicate()) return true;
  }
  return false; // caller can assert on this
};


beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  parquetCfgGet.mockReturnValue(null);
  dbGetFilename.mockResolvedValue('myfile.parquet');

  duckInsert.mockResolvedValue(undefined);
  duckRowCount.mockResolvedValue(12345);
  duckCols.mockResolvedValue(['a', 'b', 'srcid']);
  duckQuery.mockResolvedValue({
    readRows: async function* readRows(batch: number) {
      void batch;
      yield [
        { a: 1, b: 'x', srcid: 42n }, // bigint mapping → granule-xyz
        { a: 2, b: 'y', srcid: 99n }  // missing lookup → unknown_srcid_99
      ];
      return;
    }
  });

  // Default to fallback (object URL) unless a test enables the file picker path
  (globalThis as any).showSaveFilePicker = undefined;
  (globalThis as any).FileSystemWritableFileStream = undefined;

  // OPFS for exportParquet
  (globalThis as any).navigator = (globalThis as any).navigator || {};
  (globalThis as any).navigator.storage = {
    getDirectory: vi.fn().mockResolvedValue({
      getDirectoryHandle: vi.fn().mockResolvedValue({
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue(
            Object.assign(fakeFile([new Uint8Array([1, 2, 3])]), {
              stream: () => fakeReadableWithPipeTo()
            })
          )
        })
      })
    })
  };

  // fetch default for GeoParquet
  (globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: fakeReadableWithPipeTo()
  });
});

afterEach(() => {
    vi.useRealTimers(); 
});

// Capture bytes when getWritableFileStream() goes down the File Picker path
// In your test file
const setupFilePickerWriterCapture = () => {
  const writes: Uint8Array[] = [];
  const closeSpy = vi.fn().mockResolvedValue(undefined);
  const abortSpy  = vi.fn().mockResolvedValue(undefined);

  const te = new TextEncoder();
  const toU8 = (chunk: any): Uint8Array => {
    if (chunk instanceof Uint8Array) return new Uint8Array(chunk); // copy
    if (typeof chunk === 'string') return te.encode(chunk);
    if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
    if (ArrayBuffer.isView(chunk)) {
      // Handles DataView, Int8Array, etc.
      return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    // best-effort fallback
    return te.encode(String(chunk ?? ''));
  };

  // Minimal FS writable that records every write() chunk
  const fsWritable = {
    write: vi.fn(async (chunk: any) => { writes.push(toU8(chunk)); }),
    close: closeSpy,
    abort: abortSpy,
  };

  // Force the file-picker code path in your component
  (window as any).FileSystemWritableFileStream = function () {} as any;
  (globalThis as any).FileSystemWritableFileStream = (window as any).FileSystemWritableFileStream;

  const picker = { createWritable: vi.fn().mockResolvedValue(fsWritable) } as any;
  const show = vi.fn().mockResolvedValue(picker);

  (window as any).showSaveFilePicker = show;
  (globalThis as any).showSaveFilePicker = show;

  return { writes, closeSpy, abortSpy, fsWritable, picker, showSaveFilePicker: show };
};

// Helper: force file-picker path and capture bytes via fs.write
function enableFilePickerCapture() {
  const writes: Uint8Array[] = [];

  const te = new TextEncoder();
  const toU8 = async (val: any): Promise<Uint8Array> => {
    if (val == null) return new Uint8Array(0);
    if (typeof val === 'object' && 'type' in val) {
      if (val.type === 'write' && 'data' in val) return toU8(val.data);
      return new Uint8Array(0); // ignore seek/truncate
    }
    if (val instanceof Uint8Array) return new Uint8Array(val);
    if (typeof val === 'string') return te.encode(val);
    if (val instanceof ArrayBuffer) return new Uint8Array(val);
    if (ArrayBuffer.isView(val)) return new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    if (val instanceof Blob) return new Uint8Array(await val.arrayBuffer());
    return te.encode(String(val));
  };

  const fsWritable = {
    write: vi.fn(async (chunk: any) => { writes.push(await toU8(chunk)); }),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    seek: vi.fn(async (_pos?: number) => {}),
    truncate: vi.fn(async (_len?: number) => {}),
  };

  // ✅ pretend we’re in a secure context
  (globalThis as any).isSecureContext = true;

  const show = vi.fn().mockResolvedValue({
    createWritable: vi.fn().mockResolvedValue(fsWritable),
  });

  (globalThis as any).FileSystemWritableFileStream = function () {} as any;
  (globalThis as any).showSaveFilePicker = show;
  if (typeof window !== 'undefined') {
    (window as any).FileSystemWritableFileStream = (globalThis as any).FileSystemWritableFileStream;
    (window as any).showSaveFilePicker = show;
  }

  const readAll = (): Uint8Array => {
    const total = writes.reduce((n, u) => n + u.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const u of writes) { out.set(u, off); off += u.length; }
    return out;
  };
  const readText = (): string => new TextDecoder().decode(readAll());

  return { writes, fsWritable, showSaveFilePicker: show, readAll, readText };
}


describe('SrExportDialog.vue', () => {
    it('renders and disables Export until a format is selected', async () => {
        const wrapper = mountDialog();
        expect(wrapper.text()).toContain('Export Format');

        const exportBtn = wrapper.findAll('button').at(1)!;
        expect(exportBtn.attributes('disabled')).toBeDefined();

        // set <script setup> ref directly
        (wrapper.vm as any).selectedFormat = 'csv';
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('button').at(1)!.attributes('disabled')).toBeUndefined();
    });

    it('prefetches metadata on open and shows estimated size', async () => {
        const wrapper = mountDialog({ modelValue: false });
        await wrapper.setProps({ modelValue: true });

        // Wait until the watcher finished (duck calls happen) and UI text is updated
        await flushUntil((() =>
            duckInsert.mock.calls.length > 0 &&
            duckRowCount.mock.calls.length > 0 &&
            duckCols.mock.calls.length > 0 &&
            wrapper.text().includes('Approx. CSV size: ~0 MB')), 
            40
        );

        expect(duckInsert).toHaveBeenCalledWith('myfile.parquet');
        expect(duckRowCount).toHaveBeenCalled();
        expect(duckCols).toHaveBeenCalled();

        const text = wrapper.text();
        expect(text).toContain('Estimated rows: 12,345');
        expect(text).toMatch(/Approx\. CSV size:\s*~0 MB/);
    });


    it('exports Parquet using zero-copy stream pipeTo', async () => {
        const wrapper = mountDialog();
        (wrapper.vm as any).selectedFormat = 'parquet';
        await wrapper.vm.$nextTick();

        await wrapper.findAll('button').at(1)!.trigger('click');
        await flushUntil(() => toastAdd.mock.calls.length > 0, 40);

        expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Export Complete' })
        );

    });

    it('exports GeoParquet via fetch stream pipeTo', async () => {
        const wrapper = mountDialog();
        (wrapper.vm as any).selectedFormat = 'geoparquet';
        await wrapper.vm.$nextTick();

        await wrapper.findAll('button').at(1)!.trigger('click');
        await flush();

        expect(fetch).toHaveBeenCalledWith(
        '/fake/export',
        expect.objectContaining({ method: 'POST' })
        );
        expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Export Complete' })
        );
    });

    it('shows "Export Cancelled" if user cancels file picker', async () => {
        (globalThis as any).FileSystemWritableFileStream = function () {};
        (globalThis as any).showSaveFilePicker = vi.fn().mockRejectedValue({ name: 'AbortError' });

        const wrapper = mountDialog();
        (wrapper.vm as any).selectedFormat = 'csv';
        await wrapper.vm.$nextTick();

        await wrapper.findAll('button').at(1)!.trigger('click');
        await flush();

        expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info', summary: 'Export Cancelled' })
        );
        expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]).toEqual([false]);
    });

    it('shows error toast on unexpected export error', async () => {
        dbGetFilename.mockRejectedValueOnce(new Error('boom'));

        const wrapper = mountDialog();
        (wrapper.vm as any).selectedFormat = 'csv';
        await wrapper.vm.$nextTick();

        await wrapper.findAll('button').at(1)!.trigger('click');
        await flush();

        expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Export Failed' })
        );
    });
});
