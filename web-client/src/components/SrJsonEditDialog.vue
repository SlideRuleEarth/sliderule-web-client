<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type { Ref } from 'vue'
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
import { useReqParamsStore,  } from '@/stores/reqParamsStore';
import { useMapStore } from '@/stores/mapStore';
import { fromLonLat } from 'ol/proj';
import { Polygon as OlPolygon } from 'ol/geom';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import { Style, Stroke, Fill } from 'ol/style';
const reqParamsStore = useReqParamsStore();
const mapStore = useMapStore();

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

const jsonBlock = ref<HTMLElement | null>(null)
const editableReqJson = ref('')
const parsedEditableReqJson = computed(() => {
  try {
    return JSON.parse(editableReqJson.value)
  } catch {
    return {}
  }
}); 
const computedShowParamsDialog = computed({
    get: () => reqParamsStore.showParamsDialog,
    set: (val: boolean) => { reqParamsStore.showParamsDialog = val; }
}); 
const isValidJson = ref(true)
const validationError = ref<string | null>(null)



const currentReqObj = ref({});
const currentReqJson = computed(() => {
  try {
    console.log("SrJsonEditDialog computed currentReqObj:", currentReqObj.value);
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

const hasChangesToApply = computed(() => {
  if (!isValidJson.value) return false;
  return JSON.stringify(parsedEditableReqJson.value) !== JSON.stringify(parsedCurrentReqJson.value);
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
            importToStore();
        }
    };

    reader.onerror = () => {
        console.error("SrJsonEditDialog File reading error:", reader.error);
        validationError.value = "Failed to read file.";
        isValidJson.value = false;
    };

    reader.readAsText(file);
};

function validateJson() {
  try {
    //const parsed = JSON.parse(editableReqJson.value)
    console.log("SrJsonEditDialog Validating editableReqJson:", editableReqJson.value, ' parsed:', parsedEditableReqJson);
    if (props.zodSchema) {
      const result = props.zodSchema.safeParse(parsedEditableReqJson.value);
      if (!result.success) {
        isValidJson.value = false
        validationError.value = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
        console.warn('SrJsonEditDialog Validation failed:', validationError.value)
        return
      } else {
        emit('json-valid', result.data)
        console.log('SrJsonEditDialog Validation successful for:', parsedEditableReqJson.value);
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
    console.log('SrJsonEditDialog Raw JSON Copied to clipboard');
  } catch (err) {
    console.error('SrJsonEditDialog Failed to copy:', err);
  }
};


watch(computedShowParamsDialog, (newVal) => {
    //console.log('SrJsonEditDialog watch showParamsDialog changed:', newVal);
    if (newVal) {
        //console.log('SrJsonEditDialog watch showParamsDialog Dialog opened, highlighting JSON.');
        updateEditableJsonFromStore();
        nextTick(() => highlightJson());
    } else {
        //console.log('SrJsonEditDialog watch showParamsDialog Dialog closed.');
        // Zoom to poly if it exists
        zoomToPoly();
    }
});


const highlightJson = () => {
    console.log('Highlighting JSON in readonly panel.');
    if (jsonBlock.value) {
        jsonBlock.value.removeAttribute('data-highlighted'); // allow re-highlighting
        jsonBlock.value.innerHTML = readonlyHighlightedJson.value; // replace with fresh content
        hljs.highlightElement(jsonBlock.value);
    }
}

function updateEditableJsonFromStore() {
    currentReqObj.value = reqParamsStore.getAtlxxReqParams(0);
    editableReqJson.value = JSON.stringify(currentReqObj.value, null, 2);
    validateJson();
}

onMounted(() => {
    console.log('Schema in SrJsonEditDialog:', props.zodSchema);
    updateEditableJsonFromStore();
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

function handleParamsAccessed(index: number) {
    console.log('Params accessed at index (pre-flush):', index)
    nextTick(() => {
        console.log('Params accessed at index (post-flush):', index)
        currentReqObj.value = reqParamsStore.getAtlxxReqParams(index);
    });
}

function zoomToPoly() {
    const map = mapStore.getMap();
    const poly = reqParamsStore.poly;

    if (!map || !poly || poly.length === 0) {
        console.log('Cannot zoom to poly: map or poly not available');
        return;
    }

    try {
        // Find the Drawing Layer
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
        if (!vectorLayer) {
            console.error('Drawing Layer not found');
            return;
        }

        const vectorSource = (vectorLayer as any).getSource();
        if (!vectorSource) {
            console.error('Drawing Layer source not found');
            return;
        }

        // Remove existing polygon with req_id 0 or null
        const features = vectorSource.getFeatures();
        const existingFeature = features.find((f: any) => {
            const reqId = f.get('req_id');
            return reqId === 0 || reqId === null;
        });
        if (existingFeature) {
            vectorSource.removeFeature(existingFeature);
        }

        // Prepare coordinates - ensure polygon is closed
        const originalCoordinates: Coordinate[] = poly.map(p => [p.lon, p.lat]);
        if (originalCoordinates.length > 0) {
            const first = originalCoordinates[0];
            const last = originalCoordinates[originalCoordinates.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                originalCoordinates.push(first);
            }
        }

        // Convert to map projection
        const projection = map.getView().getProjection();
        let coordinates: Coordinate[];
        if (projection.getUnits() !== 'degrees') {
            coordinates = originalCoordinates.map(coord => fromLonLat(coord));
        } else {
            coordinates = originalCoordinates;
        }

        // Create and add the new polygon feature
        const polygon = new OlPolygon([coordinates]);
        const feature = new Feature({ geometry: polygon, req_id: null });

        // Use blue style for user-drawn polygons (reqId 0)
        const blueStyle = new Style({
            stroke: new Stroke({
                color: 'rgba(0, 153, 255, 1)',
                width: 2
            }),
            fill: new Fill({
                color: 'rgba(0, 153, 255, 0.1)'
            })
        });
        feature.setStyle(blueStyle);
        vectorSource.addFeature(feature);

        // Zoom to the polygon
        const extent = polygon.getExtent();
        map.getView().fit(extent, {
            size: map.getSize(),
            padding: [40, 40, 40, 40]
        });

        console.log('Updated drawing layer and zoomed to poly');
    } catch (err) {
        console.error('Error zooming to poly:', err);
    }
}

</script>

<template>
  <Dialog 
    v-model:visible="computedShowParamsDialog"
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
                        label="Save"
                        size="small"
                        icon="pi pi-check"
                        @click="importToStore"
                        class="copy-btn"
                        :disabled="!hasChangesToApply"
                        severity="success"
                    />
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
                        @click="copyEditableReqJsonToClipboard" 
                        class="copy-btn" 
                    />
                    <Button 
                        label="Output to File" 
                        size="small" 
                        icon="pi pi-file-export" 
                        @click="exportToFile(editableReqJson)" 
                        class="copy-btn" 
                    />
                </div>
            </div>
        </div>
        <div class = "sr-diff-footer">
            <SrJsonDiffViewer
                :before="parsedEditableReqJson"
                :after="parsedCurrentReqJson"
                :automaticFields="new Set(['asset','output','cmr'])"
                beforeLabel="Editable Request"
                afterLabel="Current Request State"
                @forced-req_params="handleParamsAccessed"
            />
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
