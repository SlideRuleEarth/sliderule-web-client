<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, Ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import SrJsonDiffViewer from './SrJsonDiffViewer.vue'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import type { ZodTypeAny } from 'zod'
import { useJsonImporter } from '@/composables/SrJsonImporter'
import { importRequestJsonToStore } from '@/utils/importRequestToStore';
import { useToast } from 'primevue/usetoast';
import { useReqParamsStore } from '@/stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

const toast = useToast();

hljs.registerLanguage('json', json)


function showToast(summary: string, detail: string, severity = 'warn') {
    toast.add({
        severity,
        summary,
        detail,
    });
}

const props = withDefaults(defineProps<{
  zodSchema: ZodTypeAny
  width?: string,
  title?: string,
}>(), {
  width: '60vw',
  title: 'JSON Viewer'
})

const emit = defineEmits<{
  (e: 'json-valid', value: any): void
}>()

const modelValue = defineModel<boolean>({ default: false })
const jsonBlock = ref<HTMLElement | null>(null)
const editableReqJson = ref('')
const parsedEditableReqJson = computed(() => {
  try {
    return JSON.parse(editableReqJson.value)
  } catch {
    return null
  }
}); 
const isValidJson = ref(true)
const validationError = ref<string | null>(null)

const initialReqJson = computed(() => {
  try {
    const jsonObj = reqParamsStore.getAtlxxReqParams(0);
    return JSON.stringify(jsonObj, null, 2);
  } catch {
    return 'Invalid JSON'
  }
});

const currentReqObj = ref({});
const currentReqJson = computed(() => {
  try {
    return JSON.stringify(currentReqObj.value, null, 2);
  } catch {
    return 'Invalid JSON'
  }
});

const parsedCurrentReqJson = computed(() => {
  try {
    return JSON.parse(currentReqJson.value)
  } catch {
    return null
  }
});

const readonlyHighlightedJson = computed(() => {
  return hljs.highlight(currentReqJson.value, { language: 'json' }).value;
});

const fileInputRef = ref<HTMLInputElement | null>(null);

const { data: importedData, error: importError, importJson } = useJsonImporter(props.zodSchema);

const importFromFile = async () => {
    fileInputRef.value?.click();
};
const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
        let content = reader.result as string;

        // RTF files usually start with "{\rtf" or "{\\rtf"
        const isRTF = content.trimStart().startsWith('{\\rtf') || content.trimStart().startsWith('{\rtf');
        if (isRTF) {
            isValidJson.value = false;
            validationError.value = 'This file appears to be an RTF (Rich Text Format) file. Please save it as plain JSON (UTF-8) and try again.';
            return;
        }

        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        content = content.trim();
        importJson(content);

        if (importError.value) {
            isValidJson.value = false;
            validationError.value = importError.value;
        } else if (importedData.value) {
            editableReqJson.value = JSON.stringify(importedData.value, null, 2);
            validateJson(); // re-validate after import
        }
    };

    reader.onerror = () => {
        console.error("File reading error:", reader.error);
        validationError.value = "Failed to read file.";
        isValidJson.value = false;
    };

    reader.readAsText(file);
};


function updateEditableReqJsonFromInitalReqJson() {
  editableReqJson.value = initialReqJson.value
  console.log('Updated editableReqJson:', editableReqJson.value)
}

function validateJson() {
  try {
    //const parsed = JSON.parse(editableReqJson.value)
    console.log("Validating editableReqJson:", editableReqJson.value, ' parsed:', parsedEditableReqJson);
    if (props.zodSchema) {
      const result = props.zodSchema.safeParse(parsedEditableReqJson.value);
      if (!result.success) {
        isValidJson.value = false
        validationError.value = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
        console.warn('Validation failed:', validationError.value)
        return
      } else {
        emit('json-valid', result.data)
        console.log('Validation successful for:', parsedEditableReqJson.value);
      }
    }
    isValidJson.value = true
    validationError.value = null
  } catch (err) {
    isValidJson.value = false
    validationError.value = `Invalid JSON format: ${err}`
  }
}
const copyEditableReqJsonToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(editableReqJson.value);
    console.log('Raw JSON Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
const copyCleanToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(currentReqJson.value);
    console.log('Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

watch(modelValue, (newVal) => {
  if (newVal && editableReqJson.value !== initialReqJson.value) {
    updateEditableReqJsonFromInitalReqJson();
    nextTick(() => highlightJson());
  }
});


const highlightJson = () => {
    if (jsonBlock.value) {
        jsonBlock.value.removeAttribute('data-highlighted'); // allow re-highlighting
        jsonBlock.value.innerHTML = readonlyHighlightedJson.value; // replace with fresh content
        hljs.highlightElement(jsonBlock.value);
    }
}

onMounted(() => {
    console.log('Schema in SrJsonEditDialog:', props.zodSchema);
    currentReqObj.value = reqParamsStore.getAtlxxReqParams(0);
    updateEditableReqJsonFromInitalReqJson();
    if (modelValue.value) highlightJson()
    console.log('Mounted SrJsonEditDialog ');
})

const importToStore = () => {
    try {
        console.log('Importing JSON from editableReqJson:', editableReqJson.value);
        //const parsed = JSON.parse(editableReqJson.value);
        console.log('Importing JSON to store:', parsedEditableReqJson.value);
        importRequestJsonToStore(parsedEditableReqJson.value, showToast); // assumes parsed object fits expected input
        currentReqObj.value = reqParamsStore.getAtlxxReqParams(0);
        console.log('Request imported to store.', currentReqObj.value);
    } catch (err) {
        console.error('Import failed. Invalid JSON.', err);
        validationError.value = 'Import failed: Invalid JSON';
        isValidJson.value = false;
    }
};
function exportToFile(json: string | Ref<string>) {
    const jsonString = typeof json === 'string' ? json : json.value;

    const defaultName = `sliderule-request-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filename = prompt('Enter file name to save:', defaultName);

    if (!filename) return; // user cancelled

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

</script>

<template>
  <Dialog 
    v-model:visible="modelValue"
    :modal="true"
    :closable="true"
    :style="{ width: props.width }"
    :header=props.title
  >
    <div class = "sr-dialog-container">
        <div class="json-dual-panel">
            <!-- Editable panel -->
            <div class="json-pane">
                <h3 class="pane-title">Editable Request</h3>
                <Textarea
                    v-model="editableReqJson"
                    autoResize
                    rows="20"
                    class="w-full"
                    @input="validateJson"
                    :class="{ 'p-invalid': !isValidJson }"
                />
                <div v-if="!isValidJson" class="error-text">
                    {{ validationError }}
                </div>
                <div class="copy-btn-container">
                    <Button 
                        label="Import from File" 
                        size="small" 
                        icon="pi pi-file-import" 
                        @click="importFromFile" 
                        class="copy-btn"
                    />
                    <Button 
                        label="Copy to clipboard" 
                        size="small" 
                        icon="pi pi-copy" 
                        @click="copyEditableReqJsonToClipboard" 
                        class="copy-btn" 
                    />
                    <input 
                        type="file" 
                        ref="fileInputRef" 
                        accept=".json" 
                        style="display: none;" 
                        @change="handleFileChange" 
                    />
                </div>
            </div>
            <div class="import-btn-wrapper">
                <Button 
                    label="Push ⇨" 
                    class="import-btn" 
                    @click="importToStore" 
                />
            </div>

            <!-- Readonly panel -->
            <div class="json-pane">
                <h3 class="pane-title">Current Request State</h3>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <pre ref="jsonBlock" v-html="readonlyHighlightedJson"></pre>
                <div class="copy-btn-container">
                    <Button 
                        label="Copy to clipboard" 
                        size="small" 
                        icon="pi pi-copy" 
                        @click="copyCleanToClipboard" 
                        class="copy-btn" 
                    />
                    <Button 
                        label="Output to File" 
                        size="small" 
                        icon="pi pi-file-export" 
                        @click="exportToFile(currentReqJson)" 
                        class="copy-btn" 
                    />
                </div>
            </div>
        </div>
        <div class = "sr-diff-footer">
            <SrJsonDiffViewer :before="parsedEditableReqJson" :after="parsedCurrentReqJson" beforeLabel="Editable Request" afterLabel="Current Request State" />
        </div>
    </div>
  </Dialog>
</template>

<style scoped>
.sr-dialog-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.sr-diff-footer {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  margin-top: 1rem;
}
pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  color: white;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.copy-btn {
  flex-shrink: 0;
}
.dialog-title {
  flex: 1;
  text-align: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
}
.json-dual-panel {
  display: flex;
  gap: 1rem;
}

.json-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.pane-title {
  font-weight: bold;
  margin-bottom: 0.5rem;
  text-align: center;
}

pre {
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  color: white;
  white-space: pre-wrap;
  flex: 1;
}

.copy-btn-container {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  margin: 0.5rem 0.25rem;
  gap: 0.5rem;
}

.copy-btn {
  width: auto;
  padding: 0.4rem 0.75rem;
}
.error-text {
    color: #ef4444;
    margin-top: 0.5rem;
    white-space: pre-line;
}
.import-btn-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
}

.import-btn {
  white-space: nowrap;
  font-weight: bold;
  padding: 0.5rem 1rem;
}

</style>
