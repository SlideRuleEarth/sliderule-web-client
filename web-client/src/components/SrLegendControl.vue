<template>
  <SrMapLegendBox 
    v-if="showLegend"
    ref="legendBox"
    :reqIdStr="props.reqIdStr"
    :data_key="props.data_key"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from 'vue';
import { Control } from 'ol/control';
import SrMapLegendBox from '@/components/SrMapLegendBox.vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';

const props = withDefaults(
  defineProps<{
    reqIdStr: string;
    data_key: string;
  }>(),
  {
    reqIdStr: '',
    data_key: '',
  }
);

const emit = defineEmits(['legend-control-created']);
const legendBox = ref<InstanceType<typeof SrMapLegendBox> | null>(null);

const globalChartStore = useGlobalChartStore();

const showLegend = computed(() => {
  const min = globalChartStore.getMin(props.data_key);
  const max = globalChartStore.getMax(props.data_key);
  return min != null && max != null;
});

let customControl: Control | null = null;
let controlElement: HTMLElement | null = null;

onMounted(() => {
  watch(
    showLegend,
    async (val) => {
      if (val) {
        await nextTick();

        controlElement = document.createElement('div');
        controlElement.className = 'sr-legend-control ol-unselectable ol-control';

        if (legendBox.value?.$el) {
          controlElement.appendChild(legendBox.value.$el);

          customControl = new Control({ element: controlElement });
          emit('legend-control-created', customControl);
        } else {
          console.error('legendBox or $el is not available');
        }
      } else {
        // Cleanup when legend is hidden
        if (customControl && controlElement?.parentElement) {
          controlElement.parentElement.removeChild(controlElement);
          emit('legend-control-created', null); // Inform parent to remove the control
        }

        customControl = null;
        controlElement = null;
      }
    },
    { immediate: true }
  );
});
</script>
