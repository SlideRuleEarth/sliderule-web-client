<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import { getBaseLayersForView } from '@/composables/SrViews'
import { useMapStore } from '@/stores/mapStore'
import SrMenu from './SrMenu.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrBaseLayerControl')

const mapStore = useMapStore()
const baseLayerControlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'baselayer-control-created', _control: Control): void
  (_e: 'update-baselayer', _baseLayer: string): void
}>()

let customControl: Control | null = null

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
  emit('update-baselayer', mapStore.selectedBaseLayer)
  logger.debug('updateBaseLayer', { event: _event, selectedBaseLayer: mapStore.selectedBaseLayer })
}
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-baselayer-control ol-unselectable ol-control">
    <SrMenu
      v-model="mapStore.selectedBaseLayer"
      @change="updateBaseLayer"
      :menuOptions="getBaseLayersForView(mapStore.selectedView).value"
      :getSelectedMenuItem="mapStore.getSelectedBaseLayer"
      :setSelectedMenuItem="mapStore.setSelectedBaseLayer"
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
