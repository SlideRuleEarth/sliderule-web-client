import { db } from '@/db/SlideRuleDb'; 
import type { ElevationPlottable, } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { useSrcIdTblStore } from '@/stores/srcIdTblStore';
import { calculatePolygonArea } from '@/composables/SrTurfUtils';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { type Ref } from 'vue';

//const srcIdTblStore = useSrcIdTblStore();
declare function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

type WriterBundle = {
  writable?: WritableStream<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  getWriter: () => WritableStreamDefaultWriter<Uint8Array>; // lazy
  close: () => Promise<void>;
  abort: (reason?: any) => Promise<void>;
};

interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
}


export function safeCsvCell(val: any): string {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'bigint') return `"${val.toString()}"`;

    // 1) Plain JS arrays
    if (Array.isArray(val)) {
        const s = JSON.stringify(val);
        return `"${s.replace(/"/g, '""')}"`;
    }

    // 2) TypedArrays (Float64Array, Int32Array, etc.)
    if (ArrayBuffer.isView(val) && !(val instanceof DataView)) {
        const s = JSON.stringify(Array.from(val as unknown as Iterable<number>));
        return `"${s.replace(/"/g, '""')}"`;
    }

    // 3) Arrow vectors or similar objects exposing .toArray()
    if (val && typeof val === 'object' && typeof val.toArray === 'function') {
        const s = JSON.stringify(Array.from(val.toArray()));
        return `"${s.replace(/"/g, '""')}"`;
    }

    // 4) Strings that already look like JSON arrays
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
        return `"${val.replace(/"/g, '""')}"`;
    }

    // 5) Default: JSON.stringify (preserves your current behavior for scalars/strings)
    //    BUT if it looks like an array after stringifying, still wrap it.
    const s = JSON.stringify(val);
    if (s.startsWith('[') && s.endsWith(']')) {
        return `"${s.replace(/"/g, '""')}"`;
    }

    return s;
}


function mapToJsType(type: string | undefined): string {
    switch (type) {
        case "BOOLEAN":
            return "boolean";
        case "INT32":
        case "INT64":
        case "INT96":
        case "UINT_8":
        case "UINT_16":
        case "UINT_32":
        case "UINT_64":
        case "INT_8":
        case "INT_16":
        case "INT_32":
        case "INT_64":
        case "FLOAT":
        case "DOUBLE":
            return "number";
        case "BYTE_ARRAY":
        case "FIXED_LEN_BYTE_ARRAY":
        case "UTF8":
        case "ENUM":
        case "JSON":
        case "BSON":
            return "string";
        case "DECIMAL":
            return "string"; // Can also be a number, depending on usage
        case "DATE":
        case "TIME_MILLIS":
        case "TIME_MICROS":
        case "TIMESTAMP_MILLIS":
        case "TIMESTAMP_MICROS":
            return "Date";
        case "MAP":
        case "LIST":
            return "object";
        case "INTERVAL":
            return "string"; // Custom type, could be represented in various ways
        default:
            return "unknown";
    }
}

interface TreeNode {
    count: number;
    element?: {
        type?: string;
    };
    children: TreeNode[];
    path: string[];
}

export interface SrParquetPathTypeJsType {
    path: string[];
    type: string;
    jstype: string;
}

interface SrFieldAndType {
    field: string;
    type: string;
}

export function recurseTree(node: TreeNode): SrParquetPathTypeJsType[] {
    const results: SrParquetPathTypeJsType[] = [];

    function traverse(node: TreeNode, currentPath: string[]): void {
        if ((node.path.length>0) && node.element) { // skips root with no path
            results.push({
                path: [...currentPath, ...(node.path || [])],
                type: node.element.type || "UNKNOWN",
                jstype: mapToJsType(node.element.type)
            });
        }

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                traverse(child, [...currentPath, ...(node.path || [])]);
            });
        }
    }

    traverse(node, []);
    return results;
}

export function getFieldTypes(fieldAndType: SrParquetPathTypeJsType[]):SrFieldAndType[] {
    return fieldAndType.map((f) => {
        return {field: f.path.join('.'), type: f.jstype};
    });
}

export function getFieldNames(fieldAndType: SrParquetPathTypeJsType[]):string[] {
    return fieldAndType.map((f) => f.path.join('.'));
}   

export function findHeightNdx(fieldAndType: SrParquetPathTypeJsType[],height_fieldname:string):number {
    return fieldAndType.findIndex((f) => f.path.join('.').includes(height_fieldname));
}

export function findLongNdx(fieldAndType: SrParquetPathTypeJsType[]):number {   
    return fieldAndType.findIndex((f) => f.path.join('.').includes('longitude'));
}

export function findLatNdx(fieldAndType: SrParquetPathTypeJsType[]):number {
    return fieldAndType.findIndex((f) => f.path.join('.').includes('latitude'));
}

export function getTypes(fieldAndType: SrParquetPathTypeJsType[]):string[] {
    return fieldAndType.map((f) => f.jstype);
}

export const deleteOpfsFile = async (filename:string) => {
    try{
        console.log('deleteOpfsFile filename:',filename);
        if (!filename) {
            console.error('deleteOpfsFile filename is undefined');
            return;
        }
        const opfsRoot = await navigator.storage.getDirectory();
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: true });
        directoryHandle.removeEntry(filename);
        console.log('deleteOpfsFile Successfully deleted:',filename);
    } catch (error) {
        const errorMsg = `Failed to delete file: ${filename} error: ${error}`;
        console.error('deleteOpfsFile error:',errorMsg);
        throw new Error(errorMsg);
    }
}

export function updateExtremeLatLon(elevationData:ElevationPlottable[],
                                    localExtLatLon: ExtLatLon,
                                    localExtHMean: ExtHMean): {extLatLon:ExtLatLon,extHMean:ExtHMean} {
    elevationData.forEach(d => {
        if (d[2] < localExtHMean.minHMean) {
            localExtHMean.minHMean = d[2];
        }
        if (d[2] > localExtHMean.maxHMean) {
            localExtHMean.maxHMean = d[2];
        }
        if (d[2] < localExtHMean.lowHMean) { // TBD fix this
            localExtHMean.lowHMean = d[2];
        }
        if (d[2] > localExtHMean.highHMean) { // TBD fix this
            localExtHMean.highHMean = d[2];
        }
        if (d[1] < localExtLatLon.minLat) {
            localExtLatLon.minLat = d[1];
        }
        if (d[1] > localExtLatLon.maxLat) {
            localExtLatLon.maxLat = d[1];
        }
        if (d[0] < localExtLatLon.minLon) {
            localExtLatLon.minLon = d[0];
        }
        if (d[0] > localExtLatLon.maxLon) {
            localExtLatLon.maxLon = d[0];
        }
    });
    return {extLatLon:localExtLatLon,extHMean:localExtHMean};
}

export const getTrackFieldname = async (req_id:number) => {
    const result = await db.getFunc(req_id);
    if (result.includes('atl06')) {
        return 'gt';
    } else if (result === 'atl03sp'){
        return 'track';
    } else {
        throw new Error(`Unknown height fieldname for ${result} in getTrackFieldname`);
    }
}

export async function calculateChecksumFromOpfs(fileHandle: FileSystemFileHandle): Promise<bigint> {
    const file = await fileHandle.getFile();
    const reader = file.stream().getReader();
    let checksum = 0;

    try {
        let readResult = await reader.read(); // Initial read
        while (!readResult.done) {
            const value = readResult.value;
            if (value) {
                for (let i = 0; i < value.length; i++) {
                    checksum += value[i];
                }
            }
            readResult = await reader.read(); // Read next chunk
        }
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }

    return BigInt(checksum);
}
export const formatBytes = (bytes:number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
export function addTimestampToFilename(filename: string): string {
    if (!filename.endsWith('.parquet')) {
        throw new Error('Filename must end with .parquet');
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15); // e.g. 20250724T142301
    const baseName = filename.slice(0, -8); // remove ".parquet"
    return `${baseName}_${timestamp}.parquet`;
}

export function getApiFromFilename(filename: string): { func: string } {
    // Matches patterns like:
    // atl03x_foo.parquet
    // atl03x-phoreal_bar.parquet
    // atl03x-surface_baz.parquet
    console.warn(`getApiFromFilename Fallback->Extracting API from filename: ${filename}`);
    const regex = /^(atl[0-9]{2}[a-z]*(?:-(?:phoreal|surface))?)_/i;

    const match = filename.match(regex);
    if (match && match[1]) {
        return { func: match[1].toLowerCase() };
    }

    throw new Error(`Unable to extract API function from filename: ${filename}`);
}

export const nukeSlideRuleFolder = async () => {
    const folderName = 'SlideRule';
    let opfsRoot: FileSystemDirectoryHandle;

    try {
        // Get the root directory handle
        opfsRoot = await navigator.storage.getDirectory();
    } catch (error) {
        console.error('nukeSlideRuleFolder: Error retrieving root directory', error);
        throw error;
    }

    try {
        // Attempt to remove the SlideRule folder; if it doesn't exist, we'll catch that
        await opfsRoot.removeEntry(folderName, { recursive: true });
        console.warn(`nukeSlideRuleFolder: "${folderName}" folder removed`);
    } catch (error: any) {
        // If the folder doesn't exist, it's typically a "NotFoundError" or similar
        if (error.name === 'NotFoundError') {
            console.warn(`nukeSlideRuleFolder: "${folderName}" folder not found, ignoring...`);
        } else {
            console.error('nukeSlideRuleFolder: Error removing folder', error);
            throw new Error(`Failed to remove folder: ${error}`);
        }
    }

    try {
        // Recreate the SlideRule folder
        await opfsRoot.getDirectoryHandle(folderName, { create: true });
        console.warn(`nukeSlideRuleFolder: "${folderName}" folder re-created`);
    } catch (error) {
        console.error(`nukeSlideRuleFolder: Error re-creating "${folderName}" folder`, error);
        throw new Error(`Failed to re-create the folder: ${folderName}, error: ${error}`);
    }
};

export async function updateNumGranulesInRecord(req_id:number): Promise<void> {
    const uniqueGranules = await useSrcIdTblStore().getUniqueSourceCount(req_id);
    await db.updateRequestRecord( {req_id:req_id, num_gran: uniqueGranules});
}

export async function updateAreaInRecord(req_id:number): Promise<void> {
    const poly = await db.getSvrReqPoly(req_id);
    const area = calculatePolygonArea(poly);
    await db.updateRequestRecord( {req_id:req_id, area_of_poly: area});
}

function createObjectUrlStream(mimeType: string, suggestedName: string, maxBytes = 200 * 1024 * 1024): WriterBundle {
  let bytes = 0;
  const chunks: BlobPart[] = [];

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw new Error(`Download too large for in-memory fallback (${Math.round(bytes/1e6)} MB)`);
      chunks.push(chunk.slice()); // ensure ArrayBuffer-backed
    },
    close() {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: suggestedName });
      a.click();
      URL.revokeObjectURL(url);
    },
    abort(reason) { console.error('Stream aborted:', reason); }
  });

  let writerRef: WritableStreamDefaultWriter<Uint8Array> | undefined;

  return {
    writable,
    getWriter: () => (writerRef ??= writable.getWriter()),
    writer: undefined,
    close: async () => { if (writerRef) await writerRef.close(); },
    abort: async (r?: any) => { if (writerRef) await writerRef.abort(r); }
  };
}

function buildFilePickerTypes(suggestedName: string, mimeType: string): FilePickerAcceptType[] {
    const ext = (suggestedName.split('.').pop() || '').toLowerCase();

    // Detect GeoParquet by name; your code uses `${fileName}_GEO.parquet`
    const isParquet = ext === 'parquet';
    const isGeoParquet = isParquet && /geo|_geo/i.test(suggestedName);

    if (mimeType === 'text/csv' || ext === 'csv') {
        return [{
            description: 'CSV file',
            accept: { 'text/csv': ['.csv'] }
        }];
    }

    if (isGeoParquet) {
        // No widely adopted official MIME; octet-stream is fine
        return [{
            description: 'GeoParquet file',
            accept: { 'application/octet-stream': ['.parquet'] }
        }];
    }

    if (isParquet) {
        return [{
            description: 'Parquet file',
            accept: { 'application/octet-stream': ['.parquet'] }
        }];
    }

    // Fallback: use what you passed in
    return [{
        description: mimeType,
        accept: { [mimeType]: [ext ? `.${ext}` : ''] }
    }];
}

function wrapFsWritable(fs: FileSystemWritableFileStream): WritableStream<Uint8Array> {
    return new WritableStream<Uint8Array>({
        async write(chunk) {
            // ensure ArrayBuffer (not SharedArrayBuffer)
            await fs.write(chunk.slice());
        },
        close: () => fs.close(),
        abort: (reason) => fs.abort?.(reason)
    });
}


export async function getWritableFileStream(suggestedName: string, mimeType: string): Promise<WriterBundle | null> {
  const w = window as any;
  const canUseFilePicker = typeof w.showSaveFilePicker !== 'undefined' && typeof w.FileSystemWritableFileStream !== 'undefined';

  if (canUseFilePicker) {
    try {
      const picker = await w.showSaveFilePicker({
        suggestedName,
        types: buildFilePickerTypes(suggestedName, mimeType),
      });

      const fsWritable: FileSystemWritableFileStream = await picker.createWritable();
      const safeWritable = wrapFsWritable(fsWritable);

      let writerRef: WritableStreamDefaultWriter<Uint8Array> | undefined;

      return {
        writable: safeWritable,
        writer: undefined,
        getWriter: () => (writerRef ??= safeWritable.getWriter()),
        close: async () => { if (writerRef) await writerRef.close(); /* pipeTo closes automatically */ },
        abort: async (r?: any) => { if (writerRef) await writerRef.abort(r); }
      };
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // Fallback (memory-bound) with lazy writer
  return createObjectUrlStream(mimeType, suggestedName);
}


/**
 * Parse WKB Point geometry to extract x, y, z coordinates
 * WKB Point format (little-endian):
 * - byte 0: byte order (1 = little-endian, 0 = big-endian)
 * - bytes 1-4: geometry type (1 = Point, 1001 = PointZ)
 * - bytes 5-12: x coordinate (double)
 * - bytes 13-20: y coordinate (double)
 * - bytes 21-28: z coordinate (double, if PointZ)
 */
function parseWkbPoint(wkb: Uint8Array): { x: number; y: number; z?: number } | null {
    if (!wkb || wkb.length < 21) {
        return null;
    }

    const view = new DataView(wkb.buffer, wkb.byteOffset, wkb.byteLength);
    const byteOrder = wkb[0]; // 1 = little-endian, 0 = big-endian
    const littleEndian = byteOrder === 1;

    // Read geometry type (uint32 at offset 1)
    const geomType = view.getUint32(1, littleEndian);

    // 1 = Point (2D), 1001 = PointZ (3D), 0x80000001 = PointZ with SRID
    const isPoint = geomType === 1 || geomType === 1001 || geomType === 0x80000001;

    if (!isPoint) {
        console.warn('Geometry type is not a Point:', geomType);
        return null;
    }

    // Read coordinates (doubles at offsets 5, 13, and optionally 21)
    const x = view.getFloat64(5, littleEndian);
    const y = view.getFloat64(13, littleEndian);

    // Check if we have Z coordinate (PointZ types)
    const hasZ = (geomType === 1001 || geomType === 0x80000001) && wkb.length >= 29;
    const z = hasZ ? view.getFloat64(21, littleEndian) : undefined;

    return { x, y, z };
}

interface RecordInfo {
    time?: string;
    as_geo?: boolean;
    x: string;
    y: string;
    z?: string;
}

interface GeoMetadata {
    version?: string;
    primary_column?: string;
    columns?: Record<string, any>;
}

export async function exportCsvStreamed(fileName: string, headerCols: Ref<string[]>, expandGeometry = false) {
    const duck = await createDuckDbClient();
    await duck.insertOpfsParquet(fileName);

    let columns = headerCols.value;
    let geometryColumn: string | null = null;
    let recordInfo: RecordInfo | null = null;

    // If expandGeometry is true, check for geo metadata and adjust columns
    if (expandGeometry) {
        const metadata = await duck.getAllParquetMetadata(fileName);
        if (metadata?.geo && metadata.recordinfo) {
            const geoMetadata: GeoMetadata = JSON.parse(metadata.geo);
            geometryColumn = geoMetadata.primary_column || 'geometry';
            const parsedRecordInfo: RecordInfo = JSON.parse(metadata.recordinfo);
            recordInfo = parsedRecordInfo;

            // Build new column list: remove geometry, add x,y,z
            const xColName = parsedRecordInfo.x || 'longitude';
            const yColName = parsedRecordInfo.y || 'latitude';
            const zColName = parsedRecordInfo.z || 'Zheight';

            columns = columns.filter(col => col !== geometryColumn);
            columns.push(xColName, yColName);
            if (parsedRecordInfo.z) {
                columns.push(zColName);
            }
        }
    }

    const encoder = new TextEncoder();
    const { readRows } = await duck.query(`SELECT * FROM "${fileName}"`);

    const wb = await getWritableFileStream(`${fileName}.csv`, 'text/csv');
    if (!wb) return false;

    // header
    const header = columns.map(col => (col === 'srcid' ? 'granule' : col));
    const writer = wb.getWriter();
    //console.log('[CSV] writing header:', header.join(','));

    await writer.write(encoder.encode(header.join(',') + '\n'));

    const lookup = await useSrcIdTblStore().getSourceTblForFile(fileName);

    for await (const rows of readRows(1000)) {
        const lines = rows.map(row => {
            let processedRow = row;

            // If expanding geometry, parse WKB and add x,y,z columns
            if (expandGeometry && geometryColumn && recordInfo) {
                const wkb = row[geometryColumn] as Uint8Array;
                if (wkb) {
                    const coords = parseWkbPoint(wkb);
                    if (coords) {
                        const xColName = recordInfo.x || 'lon';
                        const yColName = recordInfo.y || 'lat';
                        const zColName = recordInfo.z || 'height';

                        processedRow = { ...row };
                        processedRow[xColName] = coords.x;
                        processedRow[yColName] = coords.y;
                        if (coords.z !== undefined && recordInfo.z) {
                            processedRow[zColName] = coords.z;
                        }
                        delete processedRow[geometryColumn]; // Remove geometry column
                    }
                }
            }

            const processed = columns.map(col => {
                let val = processedRow[col];
                if (col === 'srcid') val = lookup[val] ?? `unknown_srcid_${val}`;
                return safeCsvCell(val);
            });
            return processed.join(',');
        }).join('\n') + '\n';

        const bytes = encoder.encode(lines);
        await writer.ready;          // backpressure
        //console.log('[CSV] writing batch of rows:', rows.length);
        await writer.write(bytes);
    }

    await writer.close();
    return true;
}
