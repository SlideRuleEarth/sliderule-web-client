<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import { getBaseLayersForView } from '@/composables/SrViews'
import { isGoogleLayerAvailable } from '@/composables/SrLayers'
import { useMapStore } from '@/stores/mapStore'
import SrMenu from './SrMenu.vue'
import { useToast } from 'primevue/usetoast'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrBaseLayerControl')

const mapStore = useMapStore()
const toast = useToast()
const baseLayerControlElement = ref<HTMLElement | null>(null)
const previousBaseLayer = ref<string>(mapStore.selectedBaseLayer)

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
  previousBaseLayer.value = mapStore.selectedBaseLayer
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

function updateBaseLayer(_event: Event) {
  const selectedLayer = mapStore.selectedBaseLayer

  // Check if user selected Google without a valid API key
  if (selectedLayer === 'Google' && !isGoogleLayerAvailable()) {
    logger.warn('Google base layer selected but no API key configured')

    // Show toast prompting user to add API key
    toast.add({
      severity: 'warn',
      summary: 'API Key Required',
      detail:
        'Please add your Google API key in Settings → Map Provider API Keys to use Google satellite imagery.',
      life: 6000
    })

    // Revert to previous base layer
    mapStore.setSelectedBaseLayer(previousBaseLayer.value)
    return
  }

  // Update previous layer for next time
  previousBaseLayer.value = selectedLayer

  emit('update-baselayer', selectedLayer)
  logger.debug('updateBaseLayer', { event: _event, selectedBaseLayer: selectedLayer })
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
