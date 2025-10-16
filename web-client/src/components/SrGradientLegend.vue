<template>
  <div
    v-if="isReady"
    class="sr-legend-box"
    :style="{ background: props.transparentBackground ? 'transparent' : 'rgba(255, 255, 255, 0.25)' }"
  >
    <div class="sr-color-map-gradient" :style="gradStore.gradientColorMapStyle"></div>

    <div class="sr-legend-minmax">
      <span class="sr-legend-min">{{ minValue }}</span>
      <span class="sr-legend-name">{{ computedDataKey }}</span>
      <span class="sr-legend-max">{{ maxValue }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useChartStore } from '@/stores/chartStore';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';

const props = withDefaults(
  defineProps<{
    isOverlay?: boolean;
    reqId: number;
    transparentBackground?: boolean;
  }>(),
  {
    isOverlay: false,
    reqId: 0,
    transparentBackground: false
  }
);
const computedDataKey = computed(() => {
    const key = props.reqId ? String(props.reqId) : '';
    if (!key) return 'solid';
    // Prefer the store getter (it can guard internally)
    return chartStore.getSelectedColorEncodeData(key) ?? 'solid';
});
const chartStore = useChartStore();
const globalChartStore = useGlobalChartStore();
const recTreeStore = useRecTreeStore();
const atlChartFilterStore = useAtlChartFilterStore();

const overlayReqIdStr = computed(() => {
  const ids = atlChartFilterStore.selectedOverlayedReqIds;
  return ids && ids.length ? String(ids[0]) : '';
});

const reqIdStr = computed(() => (props.isOverlay ? overlayReqIdStr.value : (recTreeStore.selectedReqIdStr || '')));

// ⬇️ use a computed that returns the store instance for the current reqId
let gradStore = useGradientColorMapStore(reqIdStr.value);

watch(reqIdStr, id => {
  gradStore = useGradientColorMapStore(id);
});

watch(
  () => [
    gradStore.selectedGradientColorMapName,
    gradStore.numShadesForGradient
  ],
  () => {
    gradStore.updateGradientColorMapValues();
  }
);


// Helpers
const fmt = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? '?' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);

const colorEncode = computed(() => {
  const id = reqIdStr.value;
  if (!id) return undefined;
  return chartStore.getSelectedColorEncodeData(id);
});

const useSelectedMinMax = computed<boolean>(() => {
  const id = reqIdStr.value;
  const retBool = !!chartStore.stateByReqId[id]?.useSelectedMinMax;
  //console.log('useSelectedMinMax for reqIdStr:', id, ' is:', retBool);
  return retBool;
});

// Safe getters for min/max
const computedDisplayGradient = computed(() => {
  const id = reqIdStr.value;
  if (!id || !computedDataKey) return false;
  // Check if min/max values exist first to avoid warnings during loading
  if (!chartStore.hasMinMaxValues(id, computedDataKey.value)) return false;
  const min = chartStore.getMinValue(id, computedDataKey.value);
  const max = chartStore.getMaxValue(id, computedDataKey.value);
  return min !== null && max !== null && min !== undefined && max !== undefined;
});

const minValue = computed(() => {
  const id = reqIdStr.value;
  if (!id || !computedDataKey) return '?';

  const enc = colorEncode.value;
  let min: number | null | undefined;

  if (enc === 'cycle') {
    min = globalChartStore.getMinSelectedCycle();
  } else {
    min = useSelectedMinMax.value
      ? chartStore.getLow(id, computedDataKey.value)
      : globalChartStore.getLow(computedDataKey.value);
  }
  return fmt(min);
});

const maxValue = computed(() => {
  const id = reqIdStr.value;
  if (!id || !computedDataKey) return '?';

  const enc = colorEncode.value;
  let max: number | null | undefined;

  if (enc === 'cycle') {
    max = globalChartStore.getMaxSelectedCycle();
  } else {
    max = useSelectedMinMax.value
      ? chartStore.getHigh(id, computedDataKey.value)
      : globalChartStore.getHigh(computedDataKey.value);
  }
  return fmt(max);
});

const emit = defineEmits(['legendbox-created', 'picked-changed']);

onMounted(() => {
  emit('legendbox-created');
});


// Optional: only ready when we have an id, key, and can compute a range
const isReady = computed(() => !!reqIdStr.value && !!computedDataKey.value && computedDisplayGradient.value);
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
  border: 1px solid transparent;
  transition: border 0.3s ease-in-out;
}
.sr-legend-box:hover { border: 1px solid var(--p-primary-color); }
.sr-legend-minmax { display: flex; justify-content: space-between; width: 10rem; }
.sr-legend-min, .sr-legend-max { font-size: 0.75rem; }
.sr-legend-name { font-size: 0.7rem; padding: 0 0.25rem; }
.sr-legend-min { padding-left: 0.25rem; }
.sr-legend-max { padding-right: 0.25rem; }
</style>
