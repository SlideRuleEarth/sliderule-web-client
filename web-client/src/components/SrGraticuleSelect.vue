<script setup lang="ts">
import SrToggleButton from './SrToggleButton.vue'
import type { useRequestMapStore } from '@/stores/requestMapStore'
import type { useAnalysisViewMapStore } from '@/stores/analysisViewMapStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrGraticuleSelect')

const props = defineProps<{
  mapStore: ReturnType<typeof useRequestMapStore> | ReturnType<typeof useAnalysisViewMapStore>
}>()

// Handle the toggle state change
function handleGraticuleChanged() {
  logger.debug('handleGraticuleChanged', { graticuleState: props.mapStore.graticuleState })
  props.mapStore.setGraticuleForMap()
}
</script>

<template>
  <div class="sr-graticule-panel">
    <SrToggleButton
      :value="props.mapStore.graticuleState"
      :getValue="props.mapStore.getGraticuleState"
      :setValue="props.mapStore.setGraticuleState"
      label="Use Map Graticule"
      tooltipText="Toggle the graticule latitude/longitude grid lines on and off. Works in all map projections."
      tooltipUrl="https://openlayers.org/en/latest/apidoc/module-ol_layer_Graticule-Graticule.html"
      @change="handleGraticuleChanged"
    />
  </div>
</template>

<style scoped>
.sr-graticule-panel {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  margin: 1rem;
}
</style>
