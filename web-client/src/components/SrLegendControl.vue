<template>
  <SrLegendBox 
    ref="legendBox"
    :reqIdStr="props.reqIdStr"
    :data_key="props.data_key"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { Control } from 'ol/control';
import SrLegendBox from './SrLegendBox.vue';

// Props definition
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

const legendBox = ref<InstanceType<typeof SrLegendBox> | null>(null);

onMounted(async () => {
  // Ensure DOM updates are completed
  await nextTick();

  const element = document.createElement('div');
  element.className = 'sr-legend-control ol-unselectable ol-control';

  if (legendBox.value?.$el) {
    // Append the rendered SrLegendBox element to the custom control
    element.appendChild(legendBox.value.$el);
  } else {
    console.error('Error: legendBox is null or $el is undefined');
  }

  const customControl = new Control({ element });
  emit('legend-control-created', customControl);
});
</script>
