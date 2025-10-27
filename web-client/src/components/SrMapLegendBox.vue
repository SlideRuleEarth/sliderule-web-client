<template>
  <div
    class="sr-legend-box"
    :style="{
      background: props.transparentBackground ? 'transparent' : 'rgba(255, 255, 255, 0.25)'
    }"
  >
    <div class="sr-color-map-gradient" :style="elevationColorMap.getColorGradientStyle"></div>
    <div class="sr-legend-minmax">
      <span class="sr-legend-min">
        {{ minValue }}
      </span>
      <span class="sr-legend-name-with-toggle">
        <span class="sr-legend-name">{{ props.data_key }}</span>
      </span>
      <span class="sr-legend-max">
        {{ maxValue }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref as _ref, computed } from 'vue'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { watch } from 'vue'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { updateMapAndPlot } from '@/utils/SrMapUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrMapLegendBox')

const globalChartStore = useGlobalChartStore()
const elevationColorMap = useElevationColorMapStore()

// Props definition
const props = withDefaults(
  defineProps<{
    reqIdStr: string
    data_key: string
    transparentBackground?: boolean
  }>(),
  {
    reqIdStr: '',
    data_key: '',
    transparentBackground: false
  }
)

const emit = defineEmits(['legendbox-created', 'picked-changed'])

// Computed properties for min/max values based on toggle state
const minValue = computed(() => {
  const value = globalChartStore.useMapLegendFullRange
    ? globalChartStore.getMin(props.data_key)
    : globalChartStore.getLow(props.data_key)
  return value !== null && value !== undefined ? value.toFixed(1) : '?'
})

const maxValue = computed(() => {
  const value = globalChartStore.useMapLegendFullRange
    ? globalChartStore.getMax(props.data_key)
    : globalChartStore.getHigh(props.data_key)
  return value !== null && value !== undefined ? value.toFixed(1) : '?'
})

onMounted(() => {
  logger.debug('onMounted', { reqIdStr: props.reqIdStr, data_key: props.data_key })
  elevationColorMap.updateElevationColorMapValues()
  emit('legendbox-created')
  //console.log("elevationColorMap.gradientColorMap:", elevationColorMap.gradientColorMap);
})

// Watch for changes in the elevation color map or the number of shades to update the gradient
watch(
  () => [elevationColorMap.selectedElevationColorMap, elevationColorMap.numShadesForElevation],
  () => {
    elevationColorMap.updateElevationColorMapValues()
    void updateMapAndPlot('SrMapLegendBox watch elevationColorMap change')
  }
)
</script>

<style scoped>
.sr-legend-box {
  color: var(--p-primary-color);
  padding: 0.25rem;
  border-radius: var(--p-border-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 0.125rem;
}

.sr-color-map-gradient {
  border: 1px solid #ccc;
  margin: 0;
}

.sr-legend-minmax {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 10rem;
  line-height: 1;
  margin: 0;
  padding: 0;
}

.sr-legend-min {
  font-size: 0.75rem;
  padding-left: 0.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
}

.sr-legend-name-with-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  line-height: 1;
}

.sr-legend-name {
  font-size: 0.7rem;
  padding-left: 0.25rem;
  padding-right: 0;
  line-height: 1;
}

.sr-legend-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
}

.sr-legend-toggle :deep(.p-checkbox) {
  width: 0.7rem;
  height: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sr-legend-toggle :deep(.p-checkbox-box) {
  width: 0.7rem;
  height: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sr-legend-toggle :deep(.p-checkbox-icon) {
  font-size: 0.5rem;
  line-height: 1;
}

.sr-legend-max {
  font-size: 0.75rem;
  padding-right: 0.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
}
</style>
