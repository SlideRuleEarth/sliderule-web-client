<template>
    <Dialog v-model:visible="visible" modal header="Export Format" :style="{ width: '25rem' }">
        <div v-if="!exporting" class="flex flex-col gap-4">
            <div class="flex align-items-center gap-2" v-for="fmt in formats" :key="fmt.value">
                <RadioButton
                    :inputId="fmt.value"
                    name="exportFormat"
                    :value="fmt.value"
                    v-model="selectedFormat"
                />
                <label :for="fmt.value">{{ fmt.label }}</label>
            </div>

            <div v-if="rowCount !== null" class="text-sm text-gray-500 mt-2 ml-1">
                Estimated rows: {{ rowCount.toLocaleString() }}<br />
                Approx. CSV size: {{ estimatedSizeMB }} MB
            </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center gap-3 py-5">
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

declare function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;

import { ref, watch, computed, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import RadioButton from 'primevue/radiobutton';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { db } from '@/db/SlideRuleDb';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
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
const selectedFormat = ref<'csv' | 'parquet' | null>(null);
const headerCols = ref<string[]>([]);
const rowCount = ref<number | null>(null);

const formats = [
    { label: 'CSV', value: 'csv' },
    { label: 'Parquet', value: 'parquet' },
];

const estimatedSizeMB = computed(() => {
    if (rowCount.value !== null && headerCols.value.length > 0) {
        const rows = Number(rowCount.value);
        return ((rows * headerCols.value.length * 10) / 1_000_000).toFixed(2);
    }
    return '--';
});

watch(() => props.modelValue, (val) => (visible.value = val));
watch(visible, (val) => emit('update:modelValue', val));

onMounted(() => {
    const saved = useSrParquetCfgStore().getSelectedExportFormat();
    if (saved === 'csv' || saved === 'parquet') {
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
        } else {
            await exportParquet(fileName);
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

function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function exportParquet(fileName: string) {
    const opfsRoot = await navigator.storage.getDirectory();
    const folderName = 'SlideRule';
    const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();

    const blob = new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' });

    const picker = await showSaveFilePicker({
        suggestedName: `${fileName}.parquet`,
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

async function exportCsvStreamed(fileName: string) {
    const duck = await createDuckDbClient();
    await duck.insertOpfsParquet(fileName);

    const columns = headerCols.value;
    const encoder = new TextEncoder();
    const { readRows } = await duck.query(`SELECT * FROM "${fileName}"`);

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

    // Write header
    await writable.write(encoder.encode(columns.join(',') + '\n'));

    // Write row chunks
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
