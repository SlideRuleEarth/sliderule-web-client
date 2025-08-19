// @vitest-environment node
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Node doesn't have a constructible FileList. Provide one so instanceof checks work.
if (typeof globalThis.FileList === 'undefined') {
  class FileListPolyfill {
    private _files: File[];
    constructor(files: File[]) {
      this._files = files.slice();
      for (let i = 0; i < this._files.length; i++) (this as any)[i] = this._files[i];
    }
    get length() { return this._files.length; }
    item(i: number) { return this._files[i] ?? null; }
    [Symbol.iterator]() { return this._files[Symbol.iterator](); }
  }
  // @ts-expect-error: attach polyfill to global
  globalThis.FileList = FileListPolyfill;
}

// ======= HOIST-SAFE SHARED STATE =======
type BlobInput = string | ArrayBuffer | ArrayBufferView;
type ZipRec = Record<string, BlobInput>;

const STATE: {
  zipFiles: ZipRec;
  registeredEPSG: string[];
  mapExtent: number[] | undefined;
  mapObj: any;
  reqPoly: any;
  featGeoJSON: any;
} = {
  zipFiles: {},
  registeredEPSG: ['EPSG:4326', 'EPSG:3857'],
  mapExtent: [0, 0, 10, 10],
  mapObj: null,
  reqPoly: null,
  featGeoJSON: null,
};

// ======= STORE MOCKS (top-level) =======
const storesMock = {
  useGeoJsonStore: () =>
    ({
      setReqGeoJsonData: (g: any) => (STATE.reqPoly = g),
      setFeaturesGeoJsonData: (g: any) => (STATE.featGeoJSON = g),
      _debug: {
        get reqPoly() { return STATE.reqPoly; },
        get feat() { return STATE.featGeoJSON; },
      },
    } as any),
  useReqParamsStore: () => ({ poly: STATE.reqPoly } as any),
  useMapStore: () =>
    ({
      getMap: () => STATE.mapObj,
      getSrViewObj: () => ({ projectionName: 'EPSG:3857' }),
    } as any),
};

// ======= HOISTED MOCKS (read from STATE; no closure on locals) =======
vi.mock('shpjs', () => ({
  default: vi.fn(async (_input: any) => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { ok: true },
        geometry: { type: 'Point', coordinates: [1, 2] },
      },
    ],
  })),
}));

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn(async (_buf: ArrayBuffer) => {
      const files = Object.fromEntries(
        Object.entries(STATE.zipFiles).map(([name, content]) => [
          name,
          {
            async: vi.fn(async (kind: 'string' | 'arraybuffer') => {
              if (kind === 'string') {
                if (typeof content === 'string') return content;
                const u8 =
                  content instanceof ArrayBuffer
                    ? new Uint8Array(content)
                    : ArrayBuffer.isView(content)
                      ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
                      : new Uint8Array();
                return new TextDecoder().decode(u8);
              }
              // arraybuffer
              if (typeof content === 'string') return new TextEncoder().encode(content).buffer;
              if (content instanceof ArrayBuffer) return content;
              if (ArrayBuffer.isView(content)) {
                return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
              }
              return new ArrayBuffer(0);
            }),
          },
        ])
      );
      return { files };
    }),
  },
}));

vi.mock('ol/format', () => {
  class GeoJSONReaderMock {
    readFeatures(obj: any, opts: any) {
      return [{ mock: true, obj, opts }];
    }
  }
  return { GeoJSON: GeoJSONReaderMock as any };
});

vi.mock('ol/proj', () => ({
  get: (code: string) => (STATE.registeredEPSG.includes(code) ? ({ code } as any) : null),
}));

vi.mock('@/stores/geoJsonStore', () => storesMock);
vi.mock('@/stores/reqParamsStore', () => storesMock);
vi.mock('@/stores/mapStore', () => storesMock);

vi.mock('@/utils/SrMapUtils', () => ({
  handleGeoJsonLoad: vi.fn(async (_map: any, _geo: any, _opts: any) => STATE.mapExtent),
  zoomOutToFullMap: vi.fn(),
}));

vi.mock('@/utils/prjToEpsg', () => ({
    prjToSupportedEpsg: (txt: string | null | undefined): string | null =>
        !txt ? null : (txt.toLowerCase().includes('wgs_1984') ? 'EPSG:4326' : 'EPSG:3857'),
}));

// ======= helpers =======
function toBlobPart(input: BlobInput): BlobPart {
  if (typeof input === 'string') return input;
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) return input;
  return new Uint8Array(input as ArrayBufferLike);
}

export function makeFile(name: string, content: BlobInput): File {
  return new File([toBlobPart(content)], name);
}

export function buf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function makeFileList(files: File[]): FileList {
  const Ctor = (globalThis as any).FileList;
  try {
    return new Ctor(files);
  } catch {
    // Fallback (shouldn't happen with the polyfill above)
    const fl = {
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () { for (const f of files) yield f; },
    } as unknown as FileList;
    files.forEach((f, i) => ((fl as any)[i] = f));
    return fl;
  }
}


function makeFakeMap() {
  const cmds: any[] = [];
  const size = [800, 600] as const;
  const view = { fit: (extent: number[], opts: any) => cmds.push({ op: 'fit', extent, opts }) };
  const map = { getView: () => view, getSize: () => size };
  return { map: map as any, cmds };
}

// Small loader that sets STATE then imports SUT
async function loadSUT(options?: {
  zipFiles?: ZipRec;
  registeredEPSG?: string[];
  mapExtent?: number[] | undefined;
}) {
  STATE.zipFiles = options?.zipFiles ?? {};
  STATE.registeredEPSG = options?.registeredEPSG ?? ['EPSG:4326', 'EPSG:3857'];
  STATE.mapExtent = options?.mapExtent ?? [0, 0, 10, 10];
  STATE.mapObj = null;
  STATE.reqPoly = null;
  STATE.featGeoJSON = null;

  vi.resetModules(); // re-import SUT with updated STATE
  const mod = await import('@/composables/useReadShapefiles');

  return {
    mod,
    storesMock,
    setMap: (m: any) => { STATE.mapObj = m; },
  };
}

// --- test suite -----------------------------------------------------

describe('useReadShapefiles (Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('parseShapefileToGeoJSON: ZIP with non-4326 .prj yields warning & detection', async () => {
    const { mod } = await loadSUT({
      zipFiles: {
        'data.prj': 'PROJCS["Web_Mercator",GEOGCS["WGS_1984"],UNIT["Meter",1]]',
        'data.shp': buf('fake'),
      },
    });

    const zipFile = makeFile('parcel.zip', buf('zip'));
    const { geojson, warning, detectedProjection } = await mod.parseShapefileToGeoJSON(zipFile);

    expect(geojson?.type).toBe('FeatureCollection');
    expect(warning).toContain('non-EPSG:4326');
    expect(detectedProjection?.toLowerCase()).toContain('wgs_1984');
  });

  test('parseShapefileToGeoJSON: FileList with EPSG:4326 .prj has no warning', async () => {
    const { mod } = await loadSUT();

    const files = makeFileList([
      makeFile('data.prj', 'GEOGCS["GCS_WGS_1984"]'),
      makeFile('data.shp', buf('x')),
      makeFile('data.shx', buf('x')),
      makeFile('data.dbf', buf('x')),
    ]);

    const { warning, detectedProjection } = await mod.parseShapefileToGeoJSON(files);

    expect(warning).toBeNull();
    expect(detectedProjection?.toLowerCase()).toContain('wgs_1984');
  });

  test('parseShapefileToGeoJSON: URL map uses fetch and returns GeoJSON', async () => {
    const { mod } = await loadSUT();

    const calls: string[] = [];

    const mkResp = (bytes: Uint8Array | ArrayBuffer) => {
      const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
      return new Response(body, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
    };

    // @ts-ignore
    global.fetch = vi.fn(async (url: string) => {
      calls.push(url);
      const bytes = url.toLowerCase().endsWith('.prj')
        ? new TextEncoder().encode('GEOGCS["GCS_WGS_1984"]')
        : new TextEncoder().encode('fake');
      return mkResp(bytes);
    });

    const { geojson, warning } = await mod.parseShapefileToGeoJSON({
      shp: 'https://example.com/data.shp',
      shx: 'https://example.com/data.shx',
      dbf: 'https://example.com/data.dbf',
      prj: 'https://example.com/data.prj',
    });

    expect(calls.length).toBe(4);
    expect(geojson?.type).toBe('FeatureCollection');
    expect(warning).toBeNull();
  });

  test('loadShapefileToMap: paints, fits extent, and toasts', async () => {
    const { mod, setMap } = await loadSUT({
      zipFiles: {
        'data.prj': 'GEOGCS["GCS_WGS_1984"]',
        'data.shp': buf('fake'),
      },
      mapExtent: [0, 0, 100, 50],
    });

    const { map, cmds } = makeFakeMap();
    setMap(map);

    const toasts: any[] = [];
    const toast = { add: (t: any) => toasts.push(t) };

    const zipFile = makeFile('parcel.zip', buf('zip'));
    const res = await mod.loadShapefileToMap(zipFile, {
      loadReqPoly: true,
      fitToExtent: true,
      toast: toast as any,
      toastLifeMs: 1500,
    });

    expect(cmds.some((c) => c.op === 'fit')).toBe(true);
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].summary).toBe('Shapefile Loaded');
    expect(res.drawExtent).toEqual([0, 0, 100, 50]);
  });

  test('loadShapefileToMap: no map available logs error but returns', async () => {
    const { mod } = await loadSUT({
      zipFiles: {
        'data.prj': 'GEOGCS["GCS_WGS_1984"]',
        'data.shp': buf('fake'),
      },
      mapExtent: [0, 0, 5, 5],
    });

    const zipFile = makeFile('parcel.zip', buf('zip'));
    const res = await mod.loadShapefileToMap(zipFile);

    expect(res.drawExtent).toBeUndefined();
  });

  test('readShapefileToOlFeatures: sourceCRS via prjToSupportedEpsg, reprojects when available', async () => {
    const { mod } = await loadSUT({
      zipFiles: {
        'data.prj': 'PROJCS["PseudoMercator",GEOGCS["WGS_1984"]]', // -> EPSG:3857 by our mock
        'data.shp': buf('fake'),
      },
      registeredEPSG: ['EPSG:4326', 'EPSG:3857'],
    });

    const zipFile = makeFile('parcel.zip', buf('zip'));
    const { features, warning, detectedProjection } = await mod.readShapefileToOlFeatures(zipFile);

    const first = features[0] as any;
    // dataProjection comes from prjToSupportedEpsg(..) => EPSG:4326
    expect(first?.opts?.dataProjection).toBe('EPSG:4326');
    // target is the map projection (mocked to EPSG:3857)
    expect(first?.opts?.featureProjection).toBe('EPSG:3857');
    // detectedProjection mirrors prjToSupportedEpsg(..)
    expect(detectedProjection).toBe('EPSG:4326');
    //console.log('⚠️ warning from readShapefileToOlFeatures:', warning);
    expect(warning).toBe('Warning: The shapefile\'s .prj indicates a non-EPSG:4326 projection. This may cause misalignment.');
  });

  test('readShapefileToOlFeatures: falls back when projections not registered', async () => {
    const { mod } = await loadSUT({
      zipFiles: {
        'data.prj': 'LOCAL_CS["Some Local CRS"]', // -> EPSG:3857 by our mock
        'data.shp': buf('fake'),
      },
      registeredEPSG: ['EPSG:4326'], // 3857 missing
    });

    const zipFile = makeFile('parcel.zip', buf('zip'));
    const { features, warning } = await mod.readShapefileToOlFeatures(zipFile);

    const first = features[0] as any;
    expect(first?.opts?.featureProjection).toBeUndefined(); // target not registered
    expect(first?.opts?.dataProjection).toBe('EPSG:4326'); // fallback
    expect(warning).toMatch(/Source CRS .* is not registered; assuming EPSG:4326/);
  });
});
