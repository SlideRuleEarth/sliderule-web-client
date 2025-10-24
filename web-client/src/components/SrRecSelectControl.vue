<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch as _watch } from 'vue'
import { Control } from 'ol/control'
import { useChartStore } from '@/stores/chartStore'
import { computed } from 'vue'
import { formatBytes } from '@/utils/SrParquetUtils'
import { useRecTreeStore } from '@/stores/recTreeStore'
import TreeSelect from 'primevue/treeselect'
import { createLogger } from '@/utils/logger'

const _logger = createLogger('SrRecSelectControl')

const recordSelectorControlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'record-selector-control-created', _control: Control): void
}>()
const recTreeStore = useRecTreeStore()

let customControl: Control | null = null
const getSize = computed(() => {
  return formatBytes(useChartStore().getSize())
})
const getCnt = computed(() => {
  return new Intl.NumberFormat().format(parseInt(String(useChartStore().getRecCnt())))
})

const _tooltipTextStr = computed(() => {
  return 'Has ' + getCnt.value + ' records and is ' + getSize.value + ' in size'
})

onMounted(() => {
  if (recordSelectorControlElement.value) {
    customControl = new Control({ element: recordSelectorControlElement.value })
    emit('record-selector-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

// async function updateRecordSelector(event: Event) {
//     const key = Object.keys(event)[0];
//     const reqId = Number(key);
//     console.log("updateRecordSelector:", event,'key:', key,'reqId:', reqId,'recTreeStore.selectedValue:',recTreeStore.selectedValue, 'recTreeStore.selectedNodeKey:', recTreeStore.selectedNodeKey);
//     if(reqId>0){
//         if (recTreeStore.selectedNodeKey) {
//             console.log('updateRecordSelector recTreeStore.selectedNodeKey:', recTreeStore.selectedNodeKey);
//             const map = customControl?.getMap();
//             if(!map){
//               console.error('Map is not available in updateRecordSelector');
//             }
//         } else {
//             console.error('Failed to update selected request:', reqId);
//         }
//     } else {
//         console.error('Failed to update selected request:', reqId);
//     }
// }

function nodeSelect(_node: any) {
  // Handler for node selection event
}
</script>

<template>
  <div
    ref="recordSelectorControlElement"
    class="sr-record-selector-control ol-unselectable ol-control"
  >
    <TreeSelect
      v-model="recTreeStore.selectedValue"
      :options="recTreeStore.treeData"
      placeholder="Select a Record"
      selectionMode="single"
      size="small"
      :filter="true"
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
  margin: 0rem;
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
