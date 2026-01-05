<template>
  <div ref="colorMapSelControlElement" class="sr-col-map-sel-control ol-unselectable ol-control">
    <Select
      v-model="selectedColorMapName"
      :options="srColorMapNames"
      v-tooltip.top="'Select Color Map'"
      class="sr-color-map-select"
      size="small"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, onUnmounted, watch } from 'vue'
import { Control } from 'ol/control'
import Select from 'primevue/select'
import { srColorMapNames } from '@/utils/colorUtils'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrColMapSelControl')

let customControl: Control | null = null

const elevationColorMapStore = useElevationColorMapStore()
const { selectedElevationColorMap: storeColorMap } = storeToRefs(elevationColorMapStore)
const emit = defineEmits<{
  (_e: 'col-map-sel-control-created', _control: Control): void
}>()
const selectedColorMapName = ref('viridis')

const colorMapSelControlElement = ref<HTMLElement | null>(null)

onMounted(async () => {
  // Ensure DOM updates are completed
  await nextTick()

  const element = document.createElement('div')
  element.className = 'sr-col-map-sel-control  ol-control'

  if (colorMapSelControlElement.value) {
    customControl = new Control({ element: colorMapSelControlElement.value })
    emit('col-map-sel-control-created', customControl)
  }

  logger.debug('onMounted selected ElevationColorMap', {
    selectedElevationColorMap: elevationColorMapStore.selectedElevationColorMap
  })
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

// Watch for local selection changes and update the store
watch(selectedColorMapName, (newColorMapName, oldColorMapName) => {
  logger.debug('ElevationColorMap changed', { from: oldColorMapName, to: newColorMapName })
  elevationColorMapStore.setElevationColorMap(newColorMapName)
  elevationColorMapStore.updateElevationColorMapValues()
})

// Watch for external changes to the store (e.g., from SrGradientLegendCntrl link checkbox)
watch(storeColorMap, (newColorMapName) => {
  if (newColorMapName !== selectedColorMapName.value) {
    logger.debug('External ElevationColorMap store change detected', { newColorMapName })
    selectedColorMapName.value = newColorMapName
  }
})
</script>

<style scoped>
.sr-col-map-sel-control {
  background-color: transparent;
}

.sr-color-map-select {
  min-width: 6rem;
}

:deep(.p-select) {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border-color: var(--p-primary-color);
  padding: 0 0.25rem;
  min-height: 0;
  height: 1.4rem;
  display: flex;
  align-items: center;
}

:deep(.p-select:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.p-select-label) {
  color: black;
  font-weight: 500;
  font-size: 0.7rem;
  padding: 0;
  display: flex;
  align-items: center;
}

:deep(.p-select-dropdown) {
  color: black;
  width: 1.25rem;
  padding: 0;
  display: flex;
  align-items: center;
}
</style>
