<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Control } from 'ol/control';
import SrMenuNumberInput from './SrMenuNumberInput.vue';
import { SrMenuNumberItem, useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { computed } from "vue";
import { formatBytes } from '@/utils/SrParquetUtils';

const recordSelectorControlElement = ref<HTMLElement | null>(null);
const emit = defineEmits<{
  (e: 'record-selector-control-created', control: Control): void;
  (e: 'update-record-selector', recordItem: SrMenuNumberItem): void;
}>();
const atlChartFilterStore = useAtlChartFilterStore();

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

const selectedReqIdValue = computed(() => atlChartFilterStore.selectedReqIdMenuItem.value);

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

watch(selectedReqIdValue, async (newSelection, oldSelection) => {
    //console.log('watch useAtlChartFilterStore().selectedReqIdMenuItem --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        console.log('watch atlChartFilterStore.selectedReqIdMenuItem.value --> Request ID changed from:', oldSelection ,' to:', newSelection);
    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});
</script>

<template>
  <div ref="recordSelectorControlElement" class="sr-record-selector-control ol-unselectable ol-control">
    <SrMenuNumberInput
        v-model="atlChartFilterStore.selectedReqIdMenuItem"
        :menuOptions="atlChartFilterStore.reqIdMenuItems" 
        @change="updateRecordSelector"
        :tooltipText=tooltipTextStr
    />
  </div>
</template>

<style scoped>
:deep(.sr-menu-input-wrapper) {
  margin-top: 0.5rem;
  margin-left: 0rem;
}

.ol-control .sr-select-menu-item {
  margin:0rem;
  color: white;
  background-color: black;
  border-radius: var(--p-border-radius);
}

.sr-record-selector-control .sr-record-selector-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: row; /* Stack children horizontally */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0rem;
  padding: 0rem;
}
</style>
