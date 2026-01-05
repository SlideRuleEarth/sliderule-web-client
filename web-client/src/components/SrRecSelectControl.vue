<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch as _watch } from 'vue'
import { Control } from 'ol/control'
// import { useChartStore } from '@/stores/chartStore'
// import { computed } from 'vue'
// import { formatBytes } from '@/utils/SrParquetUtils'
import { useRecTreeStore } from '@/stores/recTreeStore'
import TreeSelect from 'primevue/treeselect'
// import { createLogger } from '@/utils/logger'

// const _logger = createLogger('SrRecSelectControl')

const recordSelectorControlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'record-selector-control-created', _control: Control): void
}>()
const recTreeStore = useRecTreeStore()

let customControl: Control | null = null
// const getSize = computed(() => {
//   return formatBytes(useChartStore().getSize())
// })
// const getCnt = computed(() => {
//   return new Intl.NumberFormat().format(parseInt(String(useChartStore().getRecCnt())))
// })

// const _tooltipTextStr = computed(() => {
//   return 'Has ' + getCnt.value + ' records and is ' + getSize.value + ' in size'
// })

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
      panelClass="sr-treeselect-panel"
      :pt="{
        panel: { class: 'sr-treeselect-panel' },
        tree: { class: 'sr-treeselect-tree' },
        filterInput: { class: 'sr-treeselect-filter' }
      }"
    />
  </div>
</template>

<style scoped>
.sr-record-selector-control {
  background-color: transparent;
}

:deep(.p-treeselect) {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  padding: 0 0.25rem;
  min-height: 0;
  height: 1.4rem;
  display: flex;
  align-items: center;
}

:deep(.p-treeselect:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.p-treeselect-label) {
  color: black;
  font-weight: 500;
  font-size: 0.7rem;
  padding: 0;
  display: flex;
  align-items: center;
}

:deep(.p-treeselect-dropdown) {
  color: black;
  width: 1.25rem;
  padding: 0;
  display: flex;
  align-items: center;
}

/* Panel/overlay styling */
:deep(.p-treeselect-panel) {
  background: color-mix(in srgb, var(--p-primary-color) 30%, white);
  border: 1px solid var(--p-primary-color);
}

:deep(.p-treeselect-filter-input) {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--p-primary-color);
  color: black;
}

:deep(.p-treeselect-items-wrapper) {
  background: transparent;
}

:deep(.p-tree) {
  background: transparent;
  color: black;
}

:deep(.p-tree-node-label) {
  color: black;
}

:deep(.p-tree-node-content:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.p-tree-node-content.p-highlight) {
  background: color-mix(in srgb, var(--p-primary-color) 50%, transparent);
  color: black;
}

:deep(.p-tree-toggler) {
  color: black;
}
</style>
