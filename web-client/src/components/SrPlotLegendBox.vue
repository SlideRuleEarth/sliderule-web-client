<template>
  <div v-if=(computedDisplayGradient)
    class="sr-legend-box"
    :style="{ background: props.transparentBackground ? 'transparent' : 'rgba(255, 255, 255, 0.25)' }"
  >
    <div class="sr-color-map-gradient" :style="gradientStyle">
    </div>
    <div class="sr-legend-minmax">
      <span class="sr-legend-min">
        {{ chartStore.getMinValue(props.reqIdStr, props.data_key) !== null && chartStore.getMinValue(props.reqIdStr, props.data_key) !== undefined ? parseFloat(chartStore.getMinValue(props.reqIdStr, props.data_key).toFixed(1)) : '?' }}
      </span>
      <span class="sr-legend-name"> {{ props.data_key }} </span>
      <span class="sr-legend-max">
        {{ chartStore.getMaxValue(props.reqIdStr, props.data_key) !== null && chartStore.getMaxValue(props.reqIdStr, props.data_key) !== undefined ? parseFloat(chartStore.getMaxValue(props.reqIdStr, props.data_key).toFixed(1)) : '?' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useChartStore } from '@/stores/chartStore';
import { computed, watch } from 'vue';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';

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

const chartStore = useChartStore();
const gradientColorMapStore =  ref<any>(null);

const computedDisplayGradient = computed(() => {
  return (  chartStore.getMinValue(props.reqIdStr, props.data_key) !== null && chartStore.getMaxValue(props.reqIdStr, props.data_key) !== null);
});

const emit = defineEmits(['legendbox-created', 'picked-changed']);
const gradientStyle = computed(() => {
  const style = gradientColorMapStore.value?.getColorGradientStyle();
  return style || { background: 'linear-gradient(to right, #ccc, #ccc)', height: '1.25rem', width: '100%' };
});

onMounted(async () => {
  gradientColorMapStore.value = await useGradientColorMapStore(props.reqIdStr);
  gradientColorMapStore.value.updateGradientColorMapValues();
  emit('legendbox-created');
});

// Watch for changes in the elevation color map or the number of shades to update the gradient
watch(
  () => [gradientColorMapStore.value?.selectedGradientColorMapName, gradientColorMapStore.value?.numShadesForGradient],
  () => {
    gradientColorMapStore.value?.updateGradientColorMapValues();
  }
);
</script>

<style scoped>
.sr-legend-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.3125rem;
  color: var(--p-primary-color);
  background-color: transparent;
  border-radius: var(--p-border-radius);
  border: 1px solid transparent; /* Initially transparent */
  transition: border 0.3s ease-in-out; /* Smooth transition effect */
}

.sr-legend-box:hover {
  background-color: transparent;
  border: 1px solid var(--p-primary-color); /* Show border on hover */
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
