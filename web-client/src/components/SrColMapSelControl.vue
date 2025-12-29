<template>
  <div ref="colorMapSelControlElement" class="sr-col-map-sel-control ol-unselectable ol-control">
    <SrMenuInput
      :menuOptions="getColorMapOptions()"
      v-model="selectedElevationColorMap"
      tooltipText="Select Color Map"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import SrMenuInput from '@/components/SrMenuInput.vue'
import { getColorMapOptions } from '@/utils/colorUtils'
import { watch } from 'vue'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrColMapSelControl')

let customControl: Control | null = null

const elevationColorMapStore = useElevationColorMapStore()
const emit = defineEmits<{
  (_e: 'col-map-sel-control-created', _control: Control): void
}>()
const selectedElevationColorMap = ref({ name: 'viridis', value: 'viridis' })

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

watch(
  selectedElevationColorMap,
  (newColorMap, oldColorMap) => {
    logger.debug('ElevationColorMap changed', { from: oldColorMap, to: newColorMap })
    elevationColorMapStore.setElevationColorMap(newColorMap.value)
    elevationColorMapStore.updateElevationColorMapValues()
    logger.debug('Selected Color Map', {
      selectedElevationColorMap: elevationColorMapStore.selectedElevationColorMap
    })
  },
  { deep: true }
)
</script>
