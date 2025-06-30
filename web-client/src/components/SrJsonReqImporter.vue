<script setup lang="ts">
import { ref } from 'vue';
import { useJsonImporter } from '@/composables/SrJsonImporter';
import { ICESat2RequestSchema } from '@/zod/ICESat2Schemas';

import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';



// Use composable to import and validate JSON
const { data, error, importJson } = useJsonImporter(ICESat2RequestSchema);

const toast = useToast();
const selectedFile = ref<File | null>(null);
const showDialog = ref(false);
const isEditable = ref(false);

function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    selectedFile.value = file;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const jsonString = reader.result as string;
        importJson(jsonString);

        if (error.value) {
            toast.add({
                severity: 'error',
                summary: 'Invalid JSON',
                detail: error.value,
                life: 5000,
            });
        } else {
            toast.add({
                severity: 'success',
                summary: 'Valid Request',
                detail: 'The JSON request is valid.',
                life: 3000,
            });
            showDialog.value = true;
        }
    };
    reader.onerror = () => {
        toast.add({
            severity: 'error',
            summary: 'File Read Error',
            detail: 'Unable to read file.',
        });
    };
    reader.readAsText(file);
}
</script>

<template>
    <div class="p-4">
        <h3 class="mb-3">Import ICESat-2 JSON Request</h3>
        <input type="file" accept=".json" @change="handleFileSelect" />

        <div v-if="data" class="text-green-600 mt-3">
            ✅ JSON is valid.
        </div>
        <div v-else-if="error" class="text-red-600 mt-3 whitespace-pre-line">
            ❌ {{ error }}
        </div>

        <!-- Toggle Edit Button -->
        <Button 
            label="Toggle Edit Mode" 
            icon="pi pi-pencil" 
            size="small"
            class="mt-3"
            :severity="isEditable ? 'warning' : 'secondary'"
            @click="isEditable = !isEditable"
            v-if="data"
        />

        <!-- JSON Viewer Dialog -->
        <SrJsonReqEditDialog
            v-model="showDialog"
            :jsonData="data"
            :editable="isEditable"
            title="ICESat-2 Request"
        />
    </div>
</template>

<style scoped>
input[type="file"] {
    margin-top: 1rem;
}
</style>
