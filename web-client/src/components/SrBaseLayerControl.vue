<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import { getBaseLayersForView } from '@/composables/SrViews'
import SrMenu from './SrMenu.vue'
import { createLogger } from '@/utils/logger'
import type { useRequestMapStore } from '@/stores/requestMapStore'
import type { useAnalysisViewMapStore } from '@/stores/analysisViewMapStore'

const logger = createLogger('SrBaseLayerControl')

interface Props {
  mapStore: ReturnType<typeof useRequestMapStore> | ReturnType<typeof useAnalysisViewMapStore>
}

const props = defineProps<Props>()
const baseLayerControlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'baselayer-control-created', _control: Control): void
  (_e: 'update-baselayer', _baseLayer: string): void
}>()

let customControl: Control | null = null

const selectedBaseLayer = computed({
  get: () => props.mapStore.selectedBaseLayer,
  set: (value: string) => props.mapStore.setSelectedBaseLayer(value)
})

onMounted(() => {
  if (baseLayerControlElement.value) {
    customControl = new Control({ element: baseLayerControlElement.value })
    emit('baselayer-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

function updateBaseLayer(_event: Event) {
  emit('update-baselayer', props.mapStore.selectedBaseLayer)
  logger.debug('updateBaseLayer', {
    event: _event,
    selectedBaseLayer: props.mapStore.selectedBaseLayer
  })
}
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-baselayer-control ol-unselectable ol-control">
    <SrMenu
      v-model="selectedBaseLayer"
      @change="updateBaseLayer"
      :menuOptions="getBaseLayersForView(props.mapStore.selectedView).value"
      :getSelectedMenuItem="props.mapStore.getSelectedBaseLayer"
      :setSelectedMenuItem="props.mapStore.setSelectedBaseLayer"
      tooltipText="Base Map Layer"
    />
  </div>
</template>

<style scoped>
.ol-control.sr-baselayer-control .select-baseLayer select {
  color: white;
  background-color: black;
  border-radius: var(--p-border-radius);
}

.sr-baselayer-control .sr-baselayer-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: row; /* Stack children horizontally */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0px;
}
</style>
