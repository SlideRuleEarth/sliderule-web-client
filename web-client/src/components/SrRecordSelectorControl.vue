<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Control } from 'ol/control';
import SrMenuInput from './SrMenuInput.vue';
import { SrMenuItem, useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { computed } from "vue";
import { formatBytes } from '@/utils/SrParquetUtils';

const recordSelectorControlElement = ref<HTMLElement | null>(null);
const emit = defineEmits<{
  (e: 'record-selector-control-created', control: Control): void;
  (e: 'update-record-selector', recordItem: SrMenuItem): void;
}>();

let customControl: Control | null = null;
const getSize = computed(() => {
    return formatBytes(useChartStore().getSize());
});
const getCnt = computed(() => {
    return new Intl.NumberFormat().format(parseInt(String(useChartStore().getRecCnt())));
});

const tooltipTextStr = computed(() => {
    return "Has " + getCnt.value + " records and is " + getSize.value + " in size";
});
onMounted(() => {
  if (recordSelectorControlElement.value) {
    customControl = new Control({ element: recordSelectorControlElement.value });
    emit('record-selector-control-created', customControl);
  }
});

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null); // Clean up control on unmount
  }
});

function updateRecordSelector(event: Event) {
  emit('update-record-selector', useAtlChartFilterStore().selectedReqIdMenuItem);
  console.log("updateRecord:", event);
}
</script>

<template>
  <div ref="recordSelectorControlElement" class="sr-record-selector-control ol-unselectable ol-control">
    <SrMenuInput
        v-model="useAtlChartFilterStore().selectedReqIdMenuItem"
        :menuOptions="useAtlChartFilterStore().reqIdMenuItems" 
        @change="updateRecordSelector"
        :tooltipText=tooltipTextStr
    />
  </div>
</template>

<style scoped>
.ol-control.sr-record-selector-control .select-baseLayer select {
  color: white;
  background-color: black;
  border-radius: var(--p-border-radius);
}

.sr-record-selector-control .sr-record-selector-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: row; /* Stack children horizontally */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0px;
}
</style>
