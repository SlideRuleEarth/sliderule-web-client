<template>
    <div ref="colorMapSelControlElement" class="sr-col-map-sel-control ol-unselectable ol-control">
        <SrMenuInput 
            :menuOptions="getColorMapOptions()" 
            v-model="selectedElevationColorMap"
        />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, onUnmounted } from 'vue';
import { Control } from 'ol/control';
import SrMenuInput from '@/components/SrMenuInput.vue';
import { getColorMapOptions } from '@/utils/colorUtils';
import { watch } from 'vue';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';

let customControl: Control | null = null;

const elevationColorMapStore = useElevationColorMapStore();
const emit = defineEmits<{
    (e: 'col-map-sel-control-created', control: Control):void;
}>();
const selectedElevationColorMap = ref({name:'viridis', value:'viridis'});

const colorMapSelControlElement = ref<HTMLElement | null>(null);

onMounted(async () => {
  // Ensure DOM updates are completed
  await nextTick();

  const element = document.createElement('div');
  element.className = 'sr-col-map-sel-control  ol-control';

  if (colorMapSelControlElement.value) {
    customControl = new Control({ element: colorMapSelControlElement.value });
    emit('col-map-sel-control-created', customControl);
  }

  console.log('onMounted selected ElevationColorMap:', elevationColorMapStore.selectedElevationColorMap );
});

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null); // Clean up control on unmount
  }
});

watch (selectedElevationColorMap, async (newColorMap, oldColorMap) => {    
    console.log('ElevationColorMap changed from:', oldColorMap ,' to:', newColorMap);
    elevationColorMapStore.setElevationColorMap(newColorMap.value);
    elevationColorMapStore.updateElevationColorMapValues();
    console.log('Selected Color Map:', elevationColorMapStore.selectedElevationColorMap);
}, { deep: true });
</script>
