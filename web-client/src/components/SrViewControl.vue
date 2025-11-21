<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Control } from 'ol/control'
import { getDefaultBaseLayerForView, getUniqueViews } from '@/composables/SrViews'
import SrMenu from './SrMenu.vue'
import { createLogger } from '@/utils/logger'
import { srProjections } from '@/composables/SrProjections'
import type { useRequestMapStore } from '@/stores/requestMapStore'

const logger = createLogger('SrViewControl')

interface Props {
  mapStore: ReturnType<typeof useRequestMapStore>
}

const props = defineProps<Props>()
const viewControlElement = ref(null)
const emit = defineEmits(['view-control-created', 'update-view'])

const selectedView = computed({
  get: () => props.mapStore.selectedView,
  set: (value: string) => props.mapStore.setSelectedView(value)
})

// Compute tooltip text showing current projection
const projectionTooltip = computed(() => {
  const srViewObj = props.mapStore.getSrViewObj()
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
  const baseLayer = getDefaultBaseLayerForView(props.mapStore.getSelectedView())
  if (baseLayer.value) {
    props.mapStore.setSelectedBaseLayer(baseLayer.value)
  } else {
    logger.error('updateView Error: defaulted baseLayer is null')
  }
  logger.debug('updateView', { view: props.mapStore.selectedView })

  emit('update-view')
}
</script>

<template>
  <div ref="viewControlElement" class="sr-view-control ol-unselectable ol-control">
    <SrMenu
      v-model="selectedView"
      @change="updateView"
      :menuOptions="getUniqueViews().value"
      :getSelectedMenuItem="props.mapStore.getSelectedView"
      :setSelectedMenuItem="props.mapStore.setSelectedView"
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
