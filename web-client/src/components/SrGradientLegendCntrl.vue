<template>
  <div class="sr-legend" v-if="gradientColorMapStore">
    <Fieldset class="sr-legend-box" :legend="props.label" :toggleable="false" :collapsed="false">
      <div class="sr-cntrls-panel">
        <div class="sr-select-with-link">
          <Select
            size="small"
            label="Color Map"
            labelFontSize="small"
            v-model="gradientColorMapStore.selectedGradientColorMapName"
            :options="srColorMapNames"
            @update:modelValue="gradientColorMapChanged"
            tooltipText="Gradient Color Map for scatter plot"
          />
          <div class="sr-link-container">
            <Checkbox
              v-model="linkToMap"
              :binary="true"
              inputId="linkToMap"
              v-tooltip.top="'Sync color map to elevation map'"
              class="sr-link-checkbox"
            />
            <label for="linkToMap" class="sr-link-label">Map</label>
          </div>
        </div>
      </div>
      <SrGradientLegend :reqId="props.req_id" :transparentBackground="true" />
    </Fieldset>
    <Button
      icon="pi pi-refresh"
      class="sr-glow-button"
      size="small"
      label="Restore Defaults"
      @click="gradientDefaultsRestored"
      variant="text"
      rounded
    ></Button>
  </div>
  <div v-else>Loading gradient color map...</div>
</template>

<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { srColorMapNames } from '@/utils/colorUtils'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import SrGradientLegend from './SrGradientLegend.vue'
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrGradientLegendCntrl')
const elevationColorMapStore = useElevationColorMapStore()
const { linkToGradient, linkedReqId, selectedElevationColorMap } =
  storeToRefs(elevationColorMapStore)

// Define props with TypeScript types
const props = withDefaults(
  defineProps<{
    req_id: number
    data_key: string
    label: string
  }>(),
  {
    req_id: 0,
    data_key: '',
    label: 'Gradient Colors Legend'
  }
)

const emit = defineEmits([
  'restore-gradient-color-defaults-click',
  'gradient-num-shades-changed',
  'gradient-color-map-changed'
])

// Initialize the store without awaiting directly
const gradientColorMapStore = useGradientColorMapStore(props.req_id.toString())

// Computed to check if this component is the linked one
const linkToMap = computed({
  get: () => linkToGradient.value && linkedReqId.value === props.req_id.toString(),
  set: (value: boolean) => {
    linkToGradient.value = value
    linkedReqId.value = value ? props.req_id.toString() : null
    if (value) {
      // Sync both ways when enabling the link
      elevationColorMapStore.setElevationColorMap(
        gradientColorMapStore.selectedGradientColorMapName
      )
      elevationColorMapStore.updateElevationColorMapValues()
    }
  }
})

onMounted(() => {
  // Await the asynchronous store initialization after mounting
  logger.debug('Mounted SrGradientLegendCntrl', { gradientColorMapStore })
})

// Watch for elevation color map changes from the map control
watch(selectedElevationColorMap, (newColorMapName) => {
  if (linkToMap.value && newColorMapName !== gradientColorMapStore.selectedGradientColorMapName) {
    logger.debug('Syncing elevation color map to gradient', { newColorMapName })
    gradientColorMapStore.setSelectedGradientColorMapName(newColorMapName)
    gradientColorMapStore.updateGradientColorMapValues()
    emit('gradient-color-map-changed')
  }
})

const gradientColorMapChanged = () => {
  gradientColorMapStore.updateGradientColorMapValues()
  if (linkToMap.value) {
    elevationColorMapStore.setElevationColorMap(gradientColorMapStore.selectedGradientColorMapName)
    elevationColorMapStore.updateElevationColorMapValues()
  }
  emit('gradient-color-map-changed')
}

const gradientDefaultsRestored = async () => {
  await gradientColorMapStore.restoreDefaultGradientColorMap()
  emit('restore-gradient-color-defaults-click')
}
</script>

<style scoped>
.sr-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
}

.sr-color-map-gradient {
  border: 1px solid #ccc; /* Optional styling for better visibility */
}

.sr-legend-minmax {
  display: flex;
  justify-content: space-between;
}
.sr-legend-min {
  font-size: 0.75rem;
  padding-left: 0.25rem;
}

.sr-legend-max {
  font-size: 0.75rem;
  padding-right: 0.25rem;
}

:deep(.sr-select-menu-default) {
  background-color: transparent;
}

.sr-legend-box {
  padding: 0.2rem; /* 3.2px equivalent */
  margin-top: 1rem;
  border-radius: var(--p-border-radius);
  position: relative; /* Enable positioning for the legend */
}

.sr-legend-restore-btn {
  align-self: center;
  margin-top: 0.5rem;
  font-size: small;
}

.sr-controls-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.5rem;
}

.sr-select-with-link {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.sr-link-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.sr-link-checkbox {
  flex-shrink: 0;
}

.sr-link-label {
  font-size: 0.625rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
}
/* Custom Fieldset legend style */
:deep(.sr-legend-box .p-fieldset-legend) {
  font-size: small;
  font-weight: normal;
  color: white;
  padding: 0.2rem;
  text-align: center;
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translate(-50%, -50%);
  background: black;
  border-radius: 0.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 1;
  padding: 0 0.5rem;
}

:deep(.p-fieldset-content-container) {
  padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
  margin: 0.5rem;
}
</style>
