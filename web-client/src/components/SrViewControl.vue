<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Control } from 'ol/control'
import { getDefaultBaseLayerForView, getUniqueViews } from '@/composables/SrViews'
import { useMapStore } from '@/stores/mapStore'
import SrMenu from './SrMenu.vue'
import { createLogger } from '@/utils/logger'
import { srProjections } from '@/composables/SrProjections'

const logger = createLogger('SrViewControl')

const mapStore = useMapStore()
const viewControlElement = ref(null)
const emit = defineEmits(['view-control-created', 'update-view'])

// Compute tooltip text showing current projection
const projectionTooltip = computed(() => {
  const srViewObj = mapStore.getSrViewObj()
  const projName = srViewObj.projectionName
  const projInfo = srProjections.value[projName]
  if (projInfo) {
    return `${projInfo.label} (${projName})`
  }
  return `${projName}`
})

onMounted(() => {
  //console.log("SrViewControl onMounted viewControlElement:", viewControlElement.value);
  if (viewControlElement.value) {
    const customControl = new Control({ element: viewControlElement.value })
    emit('view-control-created', customControl)
  }
})

function updateView() {
  //console.log("updateView view:", event);
  const baseLayer = getDefaultBaseLayerForView(mapStore.getSelectedView())
  if (baseLayer.value) {
    mapStore.setSelectedBaseLayer(baseLayer.value)
  } else {
    logger.error('updateView Error: defaulted baseLayer is null')
  }
  logger.debug('updateView', { view: mapStore.selectedView })

  emit('update-view')
}
</script>

<template>
  <div ref="viewControlElement" class="sr-view-control ol-unselectable ol-control">
    <SrMenu
      v-model="mapStore.selectedView"
      @change="updateView"
      :menuOptions="getUniqueViews().value"
      :getSelectedMenuItem="mapStore.getSelectedView"
      :setSelectedMenuItem="mapStore.setSelectedView"
      :tooltipText="projectionTooltip"
    />
  </div>
</template>

<style scoped>
.ol-control.sr-view-control .select-view select {
  color: white;
  background-color: black;
  border-radius: var(--p-border-radius);
}

.sr-view-control .sr-view-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: row; /* Stack children horizonally */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0px;
}
</style>
