<template>
    <Dialog v-model:visible="visible" modal :style="{ width: '25rem' }">
        <template #header>
            <div class="dialog-title">Export Format</div>
        </template>

        <div v-if="!exporting" class="dialog-body">
            <div class="dropdown-wrapper">
                <label for="formatSelect">Select Format</label>
                <Select
                    id="formatSelect"
                    v-model="selectedFormat"
                    :options="formats"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Choose export format"
                    class="w-full"
                />
            </div>

            <div v-if="rowCount !== null" class="size-info">
                Estimated rows: {{ rowCount.toLocaleString() }}<br />
                Approx. CSV size: ~{{ roundedSizeMB }} MB
            </div>
        </div>

        <div v-else class="exporting-body">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
            <span class="text-center">Exporting {{ selectedFormat?.toUpperCase() }}…</span>
        </div>

        <template #footer>
            <Button label="Cancel" @click="visible = false" class="p-button-text" :disabled="exporting" />
            <Button
                label="Export"
                :disabled="!selectedFormat || exporting"
                @click="handleExport"
                class="p-button-primary"
            />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { db } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import {getFetchUrlAndOptions} from "@/utils/fetchUtils";
import { useSrcIdTblStore } from '@/stores/srcIdTblStore';

declare function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

type WriterBundle = {
  writable?: WritableStream<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  getWriter: () => WritableStreamDefaultWriter<Uint8Array>; // lazy
  close: () => Promise<void>;
  abort: (reason?: any) => Promise<void>;
};


interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
}

interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

const props = defineProps<{
    reqId: number;
    modelValue: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
}>();

const toast = useToast();
const visible = ref(props.modelValue);
const exporting = ref(false);
const selectedFormat = ref<'csv' | 'parquet' | 'geoparquet' | null>(null);
const headerCols = ref<string[]>([]);
const rowCount = ref<number | null>(null);

const formats = [
    { label: 'CSV', value: 'csv' },
    { label: 'Parquet', value: 'parquet' },
    { label: 'GeoParquet', value: 'geoparquet' },
];

const estimatedSizeMB = computed(() => {
    if (rowCount.value !== null && headerCols.value.length > 0) {
        const rows = Number(rowCount.value);
        return ((rows * headerCols.value.length * 10) / 1_000_000).toFixed(2);
    }
    return '--';
});

const roundedSizeMB = computed(() => {
    const est = Number(estimatedSizeMB.value);
    return isNaN(est) ? '--' : Math.round(est);
});

watch(() => props.modelValue, (val) => (visible.value = val));
watch(visible, (val) => emit('update:modelValue', val));

onMounted(() => {
    const saved = useSrParquetCfgStore().getSelectedExportFormat();
    if (saved === 'csv' || saved === 'parquet' || saved === 'geoparquet') {
        selectedFormat.value = saved;
    }
});

watch(visible, async (val) => {
    if (val && props.reqId > 0) {
        try {
            const fileName = await db.getFilename(props.reqId);
            if (!fileName) return;
            const duck = await createDuckDbClient();
            await duck.insertOpfsParquet(fileName);
            rowCount.value = await duck.getTotalRowCount(`SELECT * FROM "${fileName}"`);
            headerCols.value = await duck.queryForColNames(fileName);
        } catch (err) {
            console.warn('Failed to pre-fetch metadata:', err);
            rowCount.value = null;
        }
    }
});

const handleExport = async () => {
    if (!props.reqId || !selectedFormat.value) return;

    exporting.value = true;
    useSrParquetCfgStore().setSelectedExportFormat(selectedFormat.value);

    try {
        const fileName = await db.getFilename(props.reqId);
        if (!fileName) throw new Error("Filename not found");
        let status = false;
        if (selectedFormat.value === 'csv') {
            status = await exportCsvStreamed(fileName);
        } else if(selectedFormat.value === 'parquet') {
            status = await exportParquet(fileName);
        } else if(selectedFormat.value === 'geoparquet') {
            status = await exportGeoParquet(fileName);
        }
        if(status){
            toast.add({
                severity: 'success',
                summary: 'Export Complete',
                detail: `${selectedFormat.value.toUpperCase()} file saved.`,
                life: 3000,
            });
        } else {
            toast.add({
                severity: 'info',
                summary: 'Export Cancelled',
                detail: `The file was NOT saved.`,
                life: 5000,
            });
        }
    } catch (err: any) {
        console.error('Export failed:', err);
        toast.add({
            severity: 'error',
            summary: 'Export Failed',
            detail: err?.message || 'An unexpected error occurred.',
            life: 5000,
        });
    } finally {
        exporting.value = false;
        visible.value = false;
    }
};

function safeCsvCell(val: any): string {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'bigint') return `"${val.toString()}"`;
    return JSON.stringify(val);
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

async function getWritableFileStream(suggestedName: string, mimeType: string): Promise<WriterBundle | null> {
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

async function exportParquet(fileName: string): Promise<boolean> {
    console.log('exportParquet fileName:', fileName);

    const opfsRoot = await navigator.storage.getDirectory();
    const directoryHandle = await opfsRoot.getDirectoryHandle('SlideRule');
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const srcFile = await fileHandle.getFile();

    const wb = await getWritableFileStream(fileName, 'application/octet-stream');
    if (!wb) return false;

    try {
        if (wb.writable && typeof srcFile.stream === 'function') {
            // zero-copy(ish) path
            await srcFile.stream().pipeTo(wb.writable);
        } else {
            // manual loop
            // exportParquet manual loop branch
            const reader = srcFile.stream().getReader();
            const writer = wb.getWriter();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    await writer.ready;
                    await writer.write(value.slice());
                }
            }
            await writer.close();
        }
        return true;
    } catch (err) {
        console.error('Stream copy failed:', err);
        try { await wb.abort(err); } catch {}
        return false;
    }
}

async function exportGeoParquet(fileName: string) : Promise<boolean>  {
    const { url, options } = await getFetchUrlAndOptions(props.reqId, true, true);

    const wb = await getWritableFileStream(`${fileName}_GEO.parquet`, 'application/octet-stream');
    if (!wb) return false;

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: options.body,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        });

        if (!response.ok || !response.body) throw new Error(`Export failed with status ${response.status}`);

        if (wb.writable) {
            // 🚀 Fast path: let the streams connect directly
            await response.body.pipeTo(wb.writable);
        } else {
            // fallback: manual loop (same as version 1)
            // exportGeoParquet manual loop branch
            const reader = response.body.getReader();
            const writer = wb.getWriter();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    await writer.ready;
                    await writer.write(value.slice());
                }
            }
            await writer.close();
        }
        return true;
    } catch (err) {
        await wb.abort(err);
        return false;
    }
}

async function exportCsvStreamed(fileName: string) {
    const duck = await createDuckDbClient();
    await duck.insertOpfsParquet(fileName);

    const columns = headerCols.value;
    const encoder = new TextEncoder();
    const { readRows } = await duck.query(`SELECT * FROM "${fileName}"`);

    const wb = await getWritableFileStream(`${fileName}.csv`, 'text/csv');
    if (!wb) return false;

    // header
    const header = columns.map(col => (col === 'srcid' ? 'granule' : col));
    const writer = wb.getWriter();
    await writer.write(encoder.encode(header.join(',') + '\n'));

    const srcIdStore = useSrcIdTblStore();
    srcIdStore.setSrcIdTblWithFileName(fileName);
    const lookup = srcIdStore.sourceTable || {};

    for await (const rows of readRows(1000)) {
        const lines = rows.map(row => {
            const processed = columns.map(col => {
                let val = row[col];
                if (col === 'srcid') val = lookup[val] ?? `unknown_srcid_${val}`;
                return safeCsvCell(val);
            });
            return processed.join(',');
        }).join('\n') + '\n';

        const bytes = encoder.encode(lines);
        await writer.ready;          // backpressure
        await writer.write(bytes);
    }

    await writer.close();
    return true;
}

</script>

<style scoped>
.dialog-title {
    width: 100%;
    text-align: center;
    font-size: 1.125rem;
    font-weight: 600;
    padding-top: 0.25rem;
    color: var(--text-color, #111827);
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
}

.dropdown-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.dropdown-wrapper label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--label-color, #374151);
}

.size-info {
    font-size: 0.875rem;
    color: var(--info-color, #6b7280);
    padding-left: 0.25rem;
}

.exporting-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.25rem 0;
    animation: pulse 1.2s infinite ease-in-out;
}

:deep(.p-select) {
    width: 100%;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.6;
        transform: scale(1.05);
    }
}

@media (prefers-color-scheme: dark) {
    .dialog-title {
        color: #ffffff;
    }

    .dropdown-wrapper label {
        color: #cbd5e1;
    }

    .size-info {
        color: #94a3b8;
    }
}
</style>
