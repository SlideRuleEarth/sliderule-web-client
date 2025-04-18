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

declare function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

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
          0
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

        if (selectedFormat.value === 'csv') {
            await exportCsvStreamed(fileName);
        } else if(selectedFormat.value === 'parquet') {
            await exportParquet(fileName);
        } else if(selectedFormat.value === 'geoparquet') {
            await exportGeoParquet(fileName);
        }

        toast.add({
            severity: 'success',
            summary: 'Export Complete',
            detail: `${selectedFormat.value.toUpperCase()} file saved.`,
            life: 3000,
        });
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

async function exportParquet(fileName: string) {
    console.log('exportParquet fileName:', fileName);
    const opfsRoot = await navigator.storage.getDirectory();
    const folderName = 'SlideRule';
    const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();

    const blob = new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' });

    const picker = await showSaveFilePicker({
        suggestedName: `${fileName}`,
        types: [
            {
                description: 'Parquet Files',
                accept: { 'application/octet-stream': ['.parquet'] },
            },
        ],
    });

    const stream = await picker.createWritable();
    await stream.write(blob);
    await stream.close();
}

async function exportGeoParquet(fileName: string) {
    const urlOptions = await getFetchUrlAndOptions(props.reqId, true, true);
    const url = urlOptions.url;
    const options = urlOptions.options;
    console.log('exportGeoParquet url:', url, 'options:', options, 'reqId:', props.reqId, 'fileName:', fileName);

    const picker = await showSaveFilePicker({
        suggestedName: `${fileName}_GEO`,
        types: [
            {
                description: 'GeoParquet Files',
                accept: { 'application/octet-stream': ['.parquet'] },
            },
        ],
    });

    const stream = await picker.createWritable();

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: options.body,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });

        if (!response.ok || !response.body) {
            throw new Error(`Export failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const writer = stream.getWriter();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) await writer.write(value);
        }

        await writer.close();
    } catch (error) {
        console.error('Failed to fetch and save GeoParquet:', error);
        toast.add({
            severity: 'error',
            summary: 'Export Error',
            detail: error instanceof Error ? error.message : 'Unknown error',
            life: 5000,
        });
        await stream.abort();
    }
}


async function exportCsvStreamed(fileName: string) {
    const duck = await createDuckDbClient();
    await duck.insertOpfsParquet(fileName);

    const columns = headerCols.value;
    const encoder = new TextEncoder();
    const { readRows } = await duck.query(`SELECT * FROM "${fileName}"`);
    console.log(`Exporting ${fileName} with columns:`, columns, 'and row count:', rowCount.value);
    const picker = await showSaveFilePicker({
        suggestedName: `${fileName}.csv`,
        types: [
            {
                description: 'CSV Files',
                accept: { 'text/csv': ['.csv'] },
            },
        ],
    });

    const writable = await picker.createWritable();
    await writable.write(encoder.encode(columns.join(',') + '\n'));

    for await (const rows of readRows(1000)) {
        const chunk = rows.map(row =>
            columns.map(col => safeCsvCell(row[col])).join(',')
        ).join('\n') + '\n';

        await writable.write(encoder.encode(chunk));
        await new Promise(r => setTimeout(r, 0));
    }

    await writable.close();
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
