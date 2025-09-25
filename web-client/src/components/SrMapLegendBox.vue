<template>
  <div
    class="sr-legend-box"
    :style="{ background: props.transparentBackground ? 'transparent' : 'rgba(255, 255, 255, 0.25)' }"
  >
    <div class="sr-color-map-gradient" :style="elevationColorMap.getColorGradientStyle">
    </div>
    <div class="sr-legend-minmax">
      <span class="sr-legend-min">
        {{ globalChartStore.getLow(props.data_key)!== null && globalChartStore.getHigh(props.data_key)!== undefined ? globalChartStore.getLow(props.data_key).toFixed(1) : '?' }}
      </span>
      <span class="sr-legend-name"> {{ props.data_key }} </span>
      <span class="sr-legend-max">
        {{ globalChartStore.getHigh(props.data_key)!== null && globalChartStore.getHigh(props.data_key)!== undefined ? globalChartStore.getHigh(props.data_key).toFixed(1) : '?' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { watch } from 'vue';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { updateMapAndPlot } from '@/utils/SrMapUtils';

const globalChartStore = useGlobalChartStore();
const elevationColorMap = useElevationColorMapStore();

// Props definition
const props = withDefaults(
  defineProps<{
    reqIdStr: string;
    data_key: string;
    transparentBackground?: boolean;
  }>(),
  {
    reqIdStr: '',
    data_key: '',
    transparentBackground: false,
  }
);

const emit = defineEmits(['legendbox-created', 'picked-changed']);

onMounted(() => {
  console.log('SrMapLegendBox onMounted: reqIdStr:', props.reqIdStr, 'data_key:', props.data_key);
  elevationColorMap.updateElevationColorMapValues();
  emit('legendbox-created');
  //console.log("elevationColorMap.gradientColorMap:", elevationColorMap.gradientColorMap);
});

// Watch for changes in the elevation color map or the number of shades to update the gradient
watch(
  () => [elevationColorMap.selectedElevationColorMap, elevationColorMap.numShadesForElevation],
  async ()  => {
    elevationColorMap.updateElevationColorMapValues();
    await updateMapAndPlot("SrMapLegendBox watch elevationColorMap change");
  }
);
</script>

<style scoped>
.sr-legend-box {
  color: var(--p-primary-color);
  padding: 0.3125rem;
  border-radius: var(--p-border-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.sr-color-map-gradient {
  border: 1px solid #ccc; /* Optional styling for better visibility */
  margin-top: 5px; /* Optional spacing */
}

.sr-legend-minmax {
  display: flex;
  justify-content: space-between;
  width: 10rem;
}
.sr-legend-min {
  font-size: 0.75rem;
  padding-left: 0.25rem;
}
.sr-legend-name {
  font-size: 0.7rem; /* a little bit smaller */
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}
.sr-legend-max {
  font-size: 0.75rem;
  padding-right: 0.25rem;
}
</style>
