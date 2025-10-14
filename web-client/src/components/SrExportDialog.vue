<template>
    <Dialog v-model:visible="visible" modal :style="{ width: '25rem' }">
        <template #header>
            <div class="dialog-title">Export Format</div>
        </template>

        <div v-if="!exporting" class="dialog-body">
            <div class="dropdown-wrapper">
                <label for="currentFormat">Current Format</label>
                <div class="current-format-value">
                    {{ currentFormat }}
                </div>
            </div>

            <div class="dropdown-wrapper">
                <label for="formatSelect">Select Exported Format</label>
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
import {getArrowFetchUrlAndOptions} from "@/utils/fetchUtils";
import { exportCsvStreamed, getWritableFileStream } from "@/utils/SrParquetUtils";
import { useFieldNameStore } from '@/stores/fieldNameStore';


const props = defineProps<{
    reqId: number;
    modelValue: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
}>();

const toast = useToast();
const fieldNameStore = useFieldNameStore();
const visible = ref(props.modelValue);
const exporting = ref(false);
const selectedFormat = ref<'csv' | 'parquet' | 'geoparquet' | null>(null);
const headerCols = ref<string[]>([]);
const rowCount = ref<number | null>(null);

const currentFormat = computed(() => {
    const isGeo = fieldNameStore.isGeoParquet(props.reqId);
    console.log(`[ExportDialog] currentFormat computed - reqId: ${props.reqId}, isGeo: ${isGeo}, asGeoCache:`, fieldNameStore.asGeoCache);
    return isGeo ? 'GeoParquet' : 'Parquet';
});

const formats = computed(() => {
    const isGeo = fieldNameStore.isGeoParquet(props.reqId);
    if (isGeo) {
        return [
            { label: 'GeoParquet', value: 'geoparquet' },
            { label: 'CSV', value: 'csv' },
        ];
    } else {
        return [
            { label: 'CSV', value: 'csv' },
            { label: 'Parquet', value: 'parquet' },
            { label: 'GeoParquet', value: 'geoparquet' },
        ];
    }
});

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
            //console.log(`[ExportDialog] Dialog opened for reqId: ${props.reqId}`);

            // Load field name metadata including as_geo flag
            await fieldNameStore.loadMetaForReqId(props.reqId);
            //console.log(`[ExportDialog] After loadMetaForReqId, asGeoCache:`, fieldNameStore.asGeoCache);

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
    if (!props.reqId || !selectedFormat.value) {
        console.warn('[Export] handleExport called with invalid state — ignored');
        return;
    }
    // 👇 prevent double invocation due to re-renders / rapid clicks in tests
    if (exporting.value) {
        console.warn('[Export] handleExport called while exporting — ignored');
        return;
    }

    exporting.value = true;
    useSrParquetCfgStore().setSelectedExportFormat(selectedFormat.value);

    try {
        const fileName = await db.getFilename(props.reqId);
        if (!fileName) throw new Error("Filename not found");
        let status = false;
        if (selectedFormat.value === 'csv') {
            status = await exportCsvStreamed(fileName,headerCols);
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
    // Check if file already has geo metadata
    const duckDbClient = await createDuckDbClient();
    const metadata = await duckDbClient.getAllParquetMetadata(fileName);

    const hasGeoMetadata = metadata && 'geo' in metadata;
    //console.log('exportGeoParquet - hasGeoMetadata:', hasGeoMetadata, metadata);
    if (hasGeoMetadata) {
        // File already has geo metadata, export as-is using exportParquet pattern
        console.log('File already has geo metadata, exporting as-is');
        const opfsRoot = await navigator.storage.getDirectory();
        const directoryHandle = await opfsRoot.getDirectoryHandle('SlideRule');
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const srcFile = await fileHandle.getFile();

        const wb = await getWritableFileStream(fileName, 'application/octet-stream');
        if (!wb) return false;

        try {
            if (wb.writable && typeof srcFile.stream === 'function') {
                await srcFile.stream().pipeTo(wb.writable);
            } else {
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
    } else {
        // No geo metadata, fetch from server with as_geo: true
        console.log('No geo metadata found, fetching GeoParquet from server');
        const { url, options } = await getArrowFetchUrlAndOptions(props.reqId, true);

        const baseFileName = fileName.replace(/\.parquet$/i, '');
        const wb = await getWritableFileStream(`${baseFileName}_GEO.parquet`, 'application/octet-stream');
        if (!wb) return false;

        try {
            console.log('Fetching GeoParquet export:', url, options);
            const response = await fetch(url, {
                method: 'POST',
                body: options.body,
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            });

            if (!response.ok || !response.body) throw new Error(`Export failed with status ${response.status}`);

            if (wb.writable) {
                await response.body.pipeTo(wb.writable);
            } else {
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
            console.error('Failed to write GeoParquet file:', err);
            try { await wb.abort(err); } catch {}
            return false;
        }
    }
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

.current-format-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--primary-color, #3b82f6);
    padding: 0.25rem 0;
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

    .current-format-value {
        color: #60a5fa;
    }

    .size-info {
        color: #94a3b8;
    }
}
</style>
