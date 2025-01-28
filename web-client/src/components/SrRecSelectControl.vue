<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Control } from 'ol/control';
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { SrMenuNumberItem } from "@/types/SrTypes";
import { useChartStore } from "@/stores/chartStore";
import { computed } from "vue";
import { formatBytes } from '@/utils/SrParquetUtils';
import { useRequestsStore } from "@/stores/requestsStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import type { SrPrimeTreeNode } from  "@/types/SrTypes";
import { buildRecTree } from "@/utils/recTreeUtils";
import TreeSelect from 'primevue/treeselect';


const recordSelectorControlElement = ref<HTMLElement | null>(null);
const emit = defineEmits<{
  (e: 'record-selector-control-created', control: Control): void;
  (e: 'update-record-selector', recordItem: SrMenuNumberItem): void;
}>();
const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const recTreeStore = useRecTreeStore();

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
const treeData = ref<SrPrimeTreeNode[]>([]);

onMounted(async () => {
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
    console.log("updateRecord:", event);
    emit('update-record-selector', useAtlChartFilterStore().selectedReqIdMenuItem);
}

// watch(selectedReqIdValue, async (newSelection, oldSelection) => {
//     console.log('watch useAtlChartFilterStore().selectedReqIdMenuItem --> Request ID changed from:', oldSelection ,' to:', newSelection);
//     try{
//         console.log('watch atlChartFilterStore.selectedReqIdMenuItem.value --> Request ID changed from:', oldSelection ,' to:', newSelection);
//     } catch (error) {
//         console.error('Failed to update selected request:', error);
//     }
// });
</script>

<template>
    <div ref="recordSelectorControlElement" class="sr-record-selector-control ol-unselectable ol-control">
        <TreeSelect
            v-model="recTreeStore.selectedNode"
            :options="recTreeStore.treeData" 
            placeholder="Select a Record"
            selectionMode="single"
            :filter="true"
            :metaKeySelection="false"
            @change="updateRecordSelector"
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
