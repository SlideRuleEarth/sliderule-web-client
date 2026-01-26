<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import SrJsonDiffViewer from './SrJsonDiffViewer.vue'
import SrParmsFormatTabs from './SrParmsFormatTabs.vue'
import { missionItems, iceSat2APIsItems, gediAPIsItems } from '@/types/SrStaticOptions'
import type { ZodTypeAny } from 'zod'
import { useJsonImporter } from '@/composables/SrJsonImporter'
import { importRequestJsonToStore } from '@/utils/importRequestToStore'
import { useToast } from 'primevue/usetoast'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useMapStore } from '@/stores/mapStore'
import { fromLonLat } from 'ol/proj'
import { Polygon as OlPolygon } from 'ol/geom'
import { Feature } from 'ol'
import type { Coordinate } from 'ol/coordinate'
import { Style, Stroke, Fill } from 'ol/style'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrJsonEditDialog')
const reqParamsStore = useReqParamsStore()
const mapStore = useMapStore()

const toast = useToast()

function showToast(summary: string, detail: string, severity = 'warn') {
  toast.add({
    severity,
    summary,
    detail
  })
}

const props = withDefaults(
  defineProps<{
    zodSchema: ZodTypeAny
    width?: string
  }>(),
  {
    width: '60vw'
  }
)

const emit = defineEmits<{
  (_e: 'json-valid', _value: unknown): void
}>()

const editableReqJson = ref('')
const parsedEditableReqJson = computed(() => {
  try {
    return JSON.parse(editableReqJson.value)
  } catch {
    return {}
  }
})
const computedShowParamsDialog = computed({
  get: () => reqParamsStore.showParamsDialog,
  set: (val: boolean) => {
    reqParamsStore.showParamsDialog = val
  }
})
const isValidJson = ref(true)
const validationError = ref<string | null>(null)

const currentReqObj = ref({})
const currentReqJson = computed(() => {
  try {
    logger.debug('computed currentReqObj', { currentReqObj: currentReqObj.value })
    return JSON.stringify(currentReqObj.value, null, 2)
  } catch {
    return 'Invalid JSON'
  }
})

const parsedCurrentReqJson = computed(() => {
  try {
    return JSON.parse(currentReqJson.value)
  } catch {
    return null
  }
})

const hasChangesToApply = computed(() => {
  if (!isValidJson.value) return false
  return JSON.stringify(parsedEditableReqJson.value) !== JSON.stringify(parsedCurrentReqJson.value)
})

// Compute automatic fields based on selected API
// These fields are auto-populated by the system and shouldn't show force checkboxes
const computedAutomaticFields = computed(() => {
  const baseFields = ['asset', 'output', 'cmr']
  const api = reqParamsStore.iceSat2SelectedAPI

  // Add API-specific automatic fields
  if (api === 'atl03x-surface' || api === 'atl06p') {
    baseFields.push('fit')
  } else if (api === 'atl03x-phoreal') {
    baseFields.push('phoreal')
  } else if (api === 'atl24x') {
    baseFields.push('atl24')
  } else if (api === 'atl13x') {
    baseFields.push('atl13')
  }

  return new Set(baseFields)
})

const fileInputRef = ref<HTMLInputElement | null>(null)

// Endpoint selector state (used in header)
const selectedMission = ref(reqParamsStore.missionValue)
const selectedAPI = ref(reqParamsStore.getCurAPIStr())

// Computed API options based on selected mission
const apiOptions = computed(() => {
  return selectedMission.value === 'ICESat-2' ? iceSat2APIsItems : gediAPIsItems
})

// Update selected API when mission changes
watch(selectedMission, (newMission) => {
  const options = newMission === 'ICESat-2' ? iceSat2APIsItems : gediAPIsItems
  // If current API is not in new mission's options, reset to first option
  if (!options.includes(selectedAPI.value)) {
    selectedAPI.value = options[0]
  }
})

// Handle mission change from header selector
function handleMissionChange() {
  reqParamsStore.setMissionValue(selectedMission.value)
  // Update API in store based on new mission
  if (selectedMission.value === 'ICESat-2') {
    reqParamsStore.setIceSat2API(selectedAPI.value)
  } else {
    reqParamsStore.setGediAPI(selectedAPI.value)
  }
  // Refresh the request parameters display
  updateEditableJsonFromStore()
}

// Handle API change from header selector
function handleAPIChange() {
  if (selectedMission.value === 'ICESat-2') {
    reqParamsStore.setIceSat2API(selectedAPI.value)
  } else {
    reqParamsStore.setGediAPI(selectedAPI.value)
  }
  // Refresh the request parameters display
  updateEditableJsonFromStore()
}

const { data: importedData, error: importError, importJson } = useJsonImporter(props.zodSchema)

const importFromFile = () => {
  fileInputRef.value?.click()
}
const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const file = input.files[0]
  const reader = new FileReader()

  reader.onload = () => {
    let content = reader.result as string

    // RTF files usually start with "{\rtf" or "{\\rtf"
    const isRTF =
      content.trimStart().startsWith('{\\rtf') || content.trimStart().startsWith('{\rtf')
    if (isRTF) {
      isValidJson.value = false
      validationError.value =
        'This file appears to be an RTF (Rich Text Format) file. Please save it as plain JSON (UTF-8) and try again.'
      return
    }

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1)
    }

    content = content.trim()
    importJson(content)

    if (importError.value) {
      isValidJson.value = false
      validationError.value = importError.value
    } else if (importedData.value) {
      editableReqJson.value = JSON.stringify(importedData.value, null, 2)
      validateJson() // re-validate after import
      importToStore()
    }
  }

  reader.onerror = () => {
    logger.error('File reading error', { error: reader.error })
    validationError.value = 'Failed to read file.'
    isValidJson.value = false
  }

  reader.readAsText(file)
}

function validateJson() {
  try {
    //const parsed = JSON.parse(editableReqJson.value)
    logger.debug('Validating editableReqJson', {
      editableReqJson: editableReqJson.value,
      parsedEditableReqJson
    })
    if (props.zodSchema) {
      const result = props.zodSchema.safeParse(parsedEditableReqJson.value)
      if (!result.success) {
        isValidJson.value = false
        validationError.value = result.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('\n')
        logger.warn('Validation failed', { validationError: validationError.value })
        return
      } else {
        emit('json-valid', result.data)
        logger.debug('Validation successful', {
          parsedEditableReqJson: parsedEditableReqJson.value
        })
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
    await navigator.clipboard.writeText(editableReqJson.value)
    logger.debug('Raw JSON copied to clipboard')
  } catch (err) {
    logger.error('Failed to copy to clipboard', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

watch(computedShowParamsDialog, (newVal) => {
  if (newVal) {
    // Initialize endpoint selectors with current store values
    selectedMission.value = reqParamsStore.missionValue
    selectedAPI.value = reqParamsStore.getCurAPIStr()
    updateEditableJsonFromStore()
  } else {
    // Zoom to poly if it exists
    zoomToPoly()
  }
})

function updateEditableJsonFromStore() {
  currentReqObj.value = reqParamsStore.getAtlxxReqParams(0).parms
  editableReqJson.value = JSON.stringify(currentReqObj.value, null, 2)
  validateJson()
}

onMounted(() => {
  logger.debug('Schema in SrJsonEditDialog', { zodSchema: props.zodSchema })
  updateEditableJsonFromStore()
  logger.debug('Mounted SrJsonEditDialog')
})

const importToStore = () => {
  try {
    logger.debug('Importing JSON from editableReqJson', { editableReqJson: editableReqJson.value })
    //const parsed = JSON.parse(editableReqJson.value);
    logger.debug('Importing JSON to store', { parsedEditableReqJson: parsedEditableReqJson.value })
    importRequestJsonToStore(parsedEditableReqJson.value, showToast) // assumes parsed object fits expected input
    currentReqObj.value = reqParamsStore.getAtlxxReqParams(0).parms
    logger.debug('Request imported to store', { currentReqObj: currentReqObj.value })
  } catch (err) {
    logger.error('Import failed - Invalid JSON', {
      error: err instanceof Error ? err.message : String(err)
    })
    validationError.value = 'Import failed: Invalid JSON'
    isValidJson.value = false
  }
}

function handleParamsAccessed(index: number) {
  logger.debug('Params accessed at index (pre-flush)', { index })
  void nextTick(() => {
    logger.debug('Params accessed at index (post-flush)', { index })
    currentReqObj.value = reqParamsStore.getAtlxxReqParams(index).parms
  })
}

function zoomToPoly() {
  const map = mapStore.getMap()
  const poly = reqParamsStore.poly

  if (!map || !poly || poly.length === 0) {
    logger.debug('Cannot zoom to poly: map or poly not available')
    return
  }

  try {
    // Find the Drawing Layer
    const vectorLayer = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('name') === 'Drawing Layer')
    if (!vectorLayer) {
      logger.error('Drawing Layer not found')
      return
    }

    const vectorSource = (vectorLayer as any).getSource()
    if (!vectorSource) {
      logger.error('Drawing Layer source not found')
      return
    }

    // Remove existing polygon with req_id 0 or null
    const features = vectorSource.getFeatures()
    const existingFeature = features.find((f: any) => {
      const reqId = f.get('req_id')
      return reqId === 0 || reqId === null
    })
    if (existingFeature) {
      vectorSource.removeFeature(existingFeature)
    }

    // Prepare coordinates - ensure polygon is closed
    const originalCoordinates: Coordinate[] = poly.map((p) => [p.lon, p.lat])
    if (originalCoordinates.length > 0) {
      const first = originalCoordinates[0]
      const last = originalCoordinates[originalCoordinates.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        originalCoordinates.push(first)
      }
    }

    // Convert to map projection
    const projection = map.getView().getProjection()
    const projectionCode = projection.getCode()
    let coordinates: Coordinate[]
    if (projection.getUnits() !== 'degrees') {
      coordinates = originalCoordinates.map((coord) => fromLonLat(coord, projectionCode))
    } else {
      coordinates = originalCoordinates
    }

    // Create and add the new polygon feature
    const polygon = new OlPolygon([coordinates])
    const feature = new Feature({ geometry: polygon, req_id: null })

    // Use blue style for user-drawn polygons (reqId 0)
    const blueStyle = new Style({
      stroke: new Stroke({
        color: 'rgba(0, 153, 255, 1)',
        width: 2
      }),
      fill: new Fill({
        color: 'rgba(0, 153, 255, 0.1)'
      })
    })
    feature.setStyle(blueStyle)
    vectorSource.addFeature(feature)

    // Zoom to the polygon
    const extent = polygon.getExtent()
    map.getView().fit(extent, {
      size: map.getSize(),
      padding: [40, 40, 40, 40]
    })

    logger.debug('Updated drawing layer and zoomed to poly')
  } catch (err) {
    logger.error('Error zooming to poly', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
</script>

<template>
  <Dialog
    v-model:visible="computedShowParamsDialog"
    :modal="true"
    :closable="true"
    :style="{ width: props.width }"
  >
    <template #header>
      <div class="endpoint-header">
        <span class="endpoint-label">endpoint =</span>
        <Select
          v-model="selectedMission"
          :options="missionItems"
          class="endpoint-mission-select"
          @change="handleMissionChange"
        />
        <Select
          v-model="selectedAPI"
          :options="apiOptions"
          class="endpoint-api-select"
          @change="handleAPIChange"
        />
      </div>
    </template>
    <div class="sr-dialog-container">
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
              style="display: none"
              @change="handleFileChange"
            />
          </div>
        </div>
        <!-- Current Request State panel with format tabs -->
        <div class="json-pane">
          <h3 class="pane-title">Current Request State</h3>
          <SrParmsFormatTabs :rcvdParms="currentReqObj" :endpoint="selectedAPI" mode="sending" />
        </div>
      </div>
      <div class="sr-diff-footer">
        <SrJsonDiffViewer
          :before="parsedEditableReqJson"
          :after="parsedCurrentReqJson"
          :automaticFields="computedAutomaticFields"
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
  align-items: stretch;
}

.json-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Make the right pane's tabs component stretch to fill available height */
.json-pane :deep(.p-tabs) {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.json-pane :deep(.p-tabpanels) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.json-pane :deep(.p-tabpanel) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.json-pane :deep(.tab-content) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.json-pane :deep(.tab-content pre) {
  flex: 1;
  max-height: none;
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

/* Endpoint header selector styles */
.endpoint-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}

.endpoint-label {
  font-weight: 600;
  color: var(--text-color);
}

.endpoint-mission-select {
  min-width: 120px;
}

.endpoint-api-select {
  min-width: 150px;
}
</style>
