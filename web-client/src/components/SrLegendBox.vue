<template>
  <div class="sr-legend-box">
    <h1 class="sr-legend-header">Elevation Legend</h1>
    <div class="sr-color-map-gradient" :style="gradientStyle">
    </div>
    <div class="sr-legend-minmax">
      <span class="sr-legend-min">
        {{ curReqSumStore.get_h_mean_Min() !== null && curReqSumStore.get_h_mean_Min() !== undefined ? parseFloat(curReqSumStore.get_h_mean_Min().toFixed(1)) : '?' }}m
      </span>
      <span class="sr-legend-max">
        {{ curReqSumStore.get_h_mean_Max() !== null && curReqSumStore.get_h_mean_Max() !== undefined ? parseFloat(curReqSumStore.get_h_mean_Max().toFixed(1)) : '?' }}m
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue'
  import { useCurReqSumStore } from '@/stores/curReqSumStore';
  import { computed,watch } from 'vue';
  import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
  const colorMapStore = useElevationColorMapStore();
  const curReqSumStore = useCurReqSumStore();

  const emit = defineEmits(['legendbox-created', 'picked-changed']);
  const gradientStyle = computed(() => {
    const style = colorMapStore.getColorGradientStyle();
    console.log('--> computed: colorMapStore.getColorGradientStyle() :', style);
    return style || { background: 'linear-gradient(to right, #ccc, #ccc)', height: '20px', width: '100%' };
  });
  
  onMounted(() => {
    //console.log(`Mounted SrLegendBox`);
    colorMapStore.updateElevationColorMapValues();
    emit('legendbox-created');
  });

// Watch for changes in the elevation color map or the number of shades to update the gradient
watch(
  () => [colorMapStore.selectedElevationColorMap, colorMapStore.numShadesForElevation],
  () => {
    colorMapStore.updateElevationColorMapValues();
  }
);

</script>

<style scoped>

.sr-legend-box {
    color: var(--p-primary-color);
    padding: 0.3125rem;
    background: rgba(255, 255, 255, 0.25);
    border-radius: var(--p-border-radius);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
}

.sr-legend-header {
    font-size: 0.75rem;
    margin: 0;
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

.sr-legend-max {
    font-size: 0.75rem;
    padding-right: 0.25rem;
}
</style>
