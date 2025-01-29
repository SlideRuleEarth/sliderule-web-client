<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Control } from 'ol/control';
import { useChartStore } from "@/stores/chartStore";
import { computed } from "vue";
import { formatBytes } from '@/utils/SrParquetUtils';
import { useRecTreeStore } from "@/stores/recTreeStore";
import TreeSelect from 'primevue/treeselect';


const recordSelectorControlElement = ref<HTMLElement | null>(null);
const emit = defineEmits<{
  (e: 'record-selector-control-created', control: Control): void;
}>();
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

async function updateRecordSelector(event: Event) {
    const key = Object.keys(event)[0];
    const reqId = await recTreeStore.updateRecMenu('from updateRecordSelector',Number(key));
    console.log("updateRecordSelector:", event,'key:', key,'reqId:', reqId,'recTreeStore.selectedValue:',recTreeStore.selectedValue, 'recTreeStore.selectedNodeKey:', recTreeStore.selectedNodeKey);
    if(reqId>0){
        if (recTreeStore.selectedNodeKey) {
            console.log('updateRecordSelector recTreeStore.selectedNodeKey:', recTreeStore.selectedNodeKey);
        } else {
            console.error('Failed to update selected request:', reqId);
        }
    } else {
        console.error('Failed to update selected request:', reqId);
    }
}

function nodeSelect(node:any) {
    console.log('nodeSelect:', node);
}

</script>

<template>
    <div ref="recordSelectorControlElement" class="sr-record-selector-control ol-unselectable ol-control">
        <TreeSelect
            v-model="recTreeStore.selectedValue"
            :options="recTreeStore.treeData" 
            placeholder="Select a Record"
            selectionMode="single"
            size="small"
            :filter="true"
            @update:modelValue="updateRecordSelector"
            @nodeSelect="nodeSelect"
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
