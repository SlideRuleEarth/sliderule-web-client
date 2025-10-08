// tests/unit/SrExportDialog.spec.ts
import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

// ---------- Hoisted spies we’ll reuse ----------
const {
  exportCsvStreamedMock,
  getWritableFileStreamMock,
  toastAdd,
  dbGetFilename,
  duckInsert,
  duckRowCount,
  duckCols,
  duckQuery,
  parquetCfgGet,
  parquetCfgSet,
} = vi.hoisted(() => ({
  exportCsvStreamedMock: vi.fn().mockResolvedValue(true),
  getWritableFileStreamMock: vi.fn(), // configured per-test
  toastAdd: vi.fn(),
  dbGetFilename: vi.fn(),
  duckInsert: vi.fn(),
  duckRowCount: vi.fn(),
  duckCols: vi.fn(),
  duckQuery: vi.fn(),
  parquetCfgGet: vi.fn(),
  parquetCfgSet: vi.fn(),
}));

const defer = <T = any>() => {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e?: any) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

// ---------- Single set of module mocks (NO duplicates) ----------
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd }),
}));

vi.mock('@/db/SlideRuleDb', () => ({
  db: { getFilename: dbGetFilename },
}));

vi.mock('@/utils/SrDuckDb', () => ({
  createDuckDbClient: vi.fn().mockResolvedValue({
    insertOpfsParquet: duckInsert,
    getTotalRowCount: duckRowCount,
    queryForColNames: duckCols,
    query: duckQuery,
    getAllParquetMetadata: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/stores/srParquetCfgStore', () => ({
  useSrParquetCfgStore: () => ({
    getSelectedExportFormat: parquetCfgGet,
    setSelectedExportFormat: parquetCfgSet,
  }),
}));

vi.mock('@/utils/fetchUtils', () => ({
  getArrowFetchUrlAndOptions: vi.fn().mockResolvedValue({
    url: '/fake/export',
    options: { body: JSON.stringify({ ok: true }), headers: {} },
  }),
}));

// Only needed because exportCsvStreamed imports this module too
vi.mock('@/utils/SrParquetUtils', () => ({
  exportCsvStreamed: exportCsvStreamedMock,
  getWritableFileStream: getWritableFileStreamMock,
}));

// ---------- Import after mocks ----------
import SrExportDialog from '@/components/SrExportDialog.vue';

// ---------- Safe component stubs (non-native) ----------
const DialogStub = {
  props: ['visible'],
  template: `
    <div data-test="dialog" :data-visible="visible">
      <slot name="header"></slot>
      <slot></slot>
      <slot name="footer"></slot>
    </div>`,
};

// Non-native: avoids DOM 'options' prop & disabled behavior
const SelectStub = {
  inheritAttrs: false,
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder', 'id'],
  template: `<div data-test="select"><slot/></div>`,
};

const ButtonStub = {
  props: ['label', 'disabled', 'class'],
  template: `<div data-test="btn" role="button" :aria-disabled="!!disabled" @click="$emit('click')"><slot/>{{label}}</div>`,
};

const SpinnerStub = { template: `<div data-test="spinner"/>` };

// ---------- Polyfills ----------
if (!globalThis.TextEncoder) {
  const { TextEncoder } = await import('node:util');
  (globalThis as any).TextEncoder = TextEncoder;
}
const realCreateElement = Document.prototype.createElement;
const clickSpy = vi.fn();
vi.spyOn(document, 'createElement').mockImplementation(function (this: Document, tag: any) {
  const el = realCreateElement.call(this, tag);
  if (tag === 'a') (el as any).click = clickSpy;
  return el;
});
const gURL: any = (globalThis as any).URL || {};
if (typeof gURL.createObjectURL !== 'function') gURL.createObjectURL = vi.fn(() => 'blob://fake');
if (typeof gURL.revokeObjectURL !== 'function') gURL.revokeObjectURL = vi.fn(() => {});
(globalThis as any).URL = gURL;

// Helpers for OPFS & streams
const fakeReadableWithPipeTo = () => ({
  pipeTo: vi.fn().mockResolvedValue(undefined),
  getReader: vi.fn(() => ({ read: vi.fn().mockResolvedValue({ done: true, value: undefined }) })),
});

// ---------- Common test helpers ----------
const mountDialog = (props: any = {}) =>
  mount(SrExportDialog, {
    props: { reqId: 1, modelValue: true, ...props },
    global: { stubs: { Dialog: DialogStub, Select: SelectStub, Button: ButtonStub, ProgressSpinner: SpinnerStub } },
  });

const flush = async () => {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
  await vi.runAllTicks();
  vi.runAllTimers();
};

const flushUntil = async (pred: () => boolean, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    await flush();
    if (pred()) return true;
  }
  return false;
};

// ---------- Test setup ----------
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  // Defaults used by both suites
  parquetCfgGet.mockReturnValue('csv');              // auto-select CSV on mount
  dbGetFilename.mockResolvedValue('atl06p_foo.parquet');

  duckInsert.mockResolvedValue(undefined);
  duckRowCount.mockResolvedValue(12345);
  duckCols.mockResolvedValue(['a', 'srcid']);
  duckQuery.mockResolvedValue({ readRows: async function* () { yield [{ a: 1, srcid: 42n }]; } });

  // Default: NOT file picker (falls back to object-URL bundle). We’ll override when needed.
  getWritableFileStreamMock.mockResolvedValue({
    // Fallback bundle; not used by CSV (we mock CSV), but Parquet/GeoParquet tests will override per-case.
    writable: undefined,
    getWriter: vi.fn(),
    close: vi.fn(),
    abort: vi.fn(),
  });

  (globalThis as any).navigator = (globalThis as any).navigator || {};
  (globalThis as any).navigator.storage = {
    getDirectory: vi.fn().mockResolvedValue({
      getDirectoryHandle: vi.fn().mockResolvedValue({
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue(Object.assign(new File([new Uint8Array([1, 2, 3])], 'f.parquet'), {
            stream: () => fakeReadableWithPipeTo(),
          })),
        }),
      }),
    }),
  };

  (globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: fakeReadableWithPipeTo(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ======================= CSV suite =======================
it('exports CSV, shows success toast, and closes the dialog', async () => {
  const wrapper = mountDialog();
  await flushPromises(); // onMounted
  await flushPromises(); // watcher warmup

  // Keep first export pending so exporting=true during second click
  const d = defer<boolean>();
  exportCsvStreamedMock.mockImplementationOnce(() => d.promise);

  const exportBtn = wrapper.findAll('[data-test="btn"]').at(-1)!;

  // 1st click: starts export (exporting=true)
  await exportBtn.trigger('click');

  // 2nd click while still exporting: should be ignored
  await exportBtn.trigger('click');

  // Still only one call so far
  expect(exportCsvStreamedMock).toHaveBeenCalledTimes(1);

  // Let export finish as success
  d.resolve(true);
  await flushPromises();

  // Toast + close assertions unchanged…
  expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
    severity: 'success',
    summary: 'Export Complete',
  }));
  const emits = wrapper.emitted('update:modelValue') ?? [];
  expect(emits.at(-1)).toEqual([false]);
  expect(parquetCfgSet).toHaveBeenCalledWith('csv');
});


// ======================= Parquet/GeoParquet suite =======================
describe('SrExportDialog.vue', () => {
  it('renders and disables Export until a format is selected', async () => {
    const wrapper = mountDialog();
    expect(wrapper.text()).toContain('Export Format');

    // Export disabled initially
    const exportBtn = wrapper.findAll('[data-test="btn"]').at(1)!;
    expect(exportBtn.attributes('aria-disabled')).toBe('true');

    // Manually select a format
    (wrapper.vm as any).selectedFormat = 'csv';
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('[data-test="btn"]').at(1)!.attributes('aria-disabled')).toBe('false');
  });

  it('prefetches metadata on open and shows estimated size', async () => {
    const wrapper = mountDialog({ modelValue: false });
    await wrapper.setProps({ modelValue: true });

    await flushUntil(
      () =>
        duckInsert.mock.calls.length > 0 &&
        duckRowCount.mock.calls.length > 0 &&
        duckCols.mock.calls.length > 0,
      40
    );

    expect(duckInsert).toHaveBeenCalledWith('atl06p_foo.parquet');
    expect(wrapper.text()).toContain('Estimated rows: 12,345');
    expect(wrapper.text()).toMatch(/Approx\. CSV size:\s*~0 MB/);
  });

  it('exports Parquet using zero-copy stream pipeTo', async () => {
    // Make getWritableFileStream return a bundle with a truthy writable (so zero-copy branch runs)
    getWritableFileStreamMock.mockResolvedValueOnce({
      writable: {}, // anything truthy is fine for our fake pipeTo
      getWriter: vi.fn(),
      close: vi.fn(),
      abort: vi.fn(),
    });

    const wrapper = mountDialog();
    (wrapper.vm as any).selectedFormat = 'parquet';
    await wrapper.vm.$nextTick();

    await wrapper.findAll('[data-test="btn"]').at(1)!.trigger('click');
    await flushUntil(() => toastAdd.mock.calls.length > 0, 40);

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Export Complete' })
    );
  });

  it('exports GeoParquet via fetch stream pipeTo', async () => {
    getWritableFileStreamMock.mockResolvedValueOnce({
      writable: {}, // used by response.body.pipeTo
      getWriter: vi.fn(),
      close: vi.fn(),
      abort: vi.fn(),
    });

    const wrapper = mountDialog();
    (wrapper.vm as any).selectedFormat = 'geoparquet';
    await wrapper.vm.$nextTick();

    await wrapper.findAll('[data-test="btn"]').at(1)!.trigger('click');
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
  // Make CSV export report "cancelled"
  exportCsvStreamedMock.mockResolvedValueOnce(false);

  const wrapper = mountDialog();
  (wrapper.vm as any).selectedFormat = 'csv';
  await wrapper.vm.$nextTick();

  await wrapper.findAll('[data-test="btn"]').at(1)!.trigger('click');
  await flush();

  expect(toastAdd).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'info', summary: 'Export Cancelled' })
  );
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
});


  it('shows error toast on unexpected export error', async () => {
    dbGetFilename.mockRejectedValueOnce(new Error('boom'));

    const wrapper = mountDialog();
    (wrapper.vm as any).selectedFormat = 'csv';
    await wrapper.vm.$nextTick();

    await wrapper.findAll('[data-test="btn"]').at(1)!.trigger('click');
    await flush();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Export Failed' })
    );
  });
});
