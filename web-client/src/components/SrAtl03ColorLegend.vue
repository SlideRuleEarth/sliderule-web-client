<template>
    <div class="legend">
      <!-- Existing ATL03 CNF color items -->
        <Fieldset
            class="sr-legend-box"
            legend="ATL03 Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div v-for="option in atl03CnfOptions" :key="option.value" class="legend-item">
                <div class="color-box" :style="{ backgroundColor: getColorForAtl03CnfValue(option.value) }"></div>
                <div class="label">{{ formatLabel(option.label) }} ({{ option.value }})</div>
            </div>
        </Fieldset>
      <!-- New Manage Colors button -->
      <div class="sr-restore-defaults">
        <Button label="Manage Atl03 Colors" @click="showDialog = true" size="small" />
      </div>
  
      <!-- Dialog that contains SrAtl03CnfColors when visible -->
      <Dialog
        v-model:visible="showDialog"
        :modal="true"
        :draggable="false"
        :resizable="false"
        header="Manage ATL03 Colors"
        @hide="onDialogHide"
      >
        <SrAtl03CnfColors
          @selectionChanged="atl03CnfColorChanged"
          @defaultsChanged="atl03CnfColorChanged"
        />
      </Dialog>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import Button from 'primevue/button';
  import Dialog from 'primevue/dialog';
  import SrAtl03CnfColors from './SrAtl03CnfColors.vue';
  import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
  import Fieldset from 'primevue/fieldset';

  const emit = defineEmits(['restore-defaults-click', 'atl03CnfColorChanged']);
  const atl03ColorMapStore = useAtl03ColorMapStore();
  
  // Dialog visibility state
  const showDialog = ref(false);
  
  onMounted(async () => {
    if (!atl03ColorMapStore.isInitialized) {
      await atl03ColorMapStore.initializeAtl03ColorMapStore();
    }
  });
  
  const atl03CnfOptions = computed(() => atl03ColorMapStore.atl03CnfOptions);
  
  const getColorForAtl03CnfValue = (value: number): string => {
    return atl03ColorMapStore.getColorForAtl03CnfValue(value);
  };
  
  const formatLabel = (label: string): string => {
    return label.replace(/^atl03_/, '').replace(/_/g, ' ');
  };
    
  // Emitted when a color changes
  const atl03CnfColorChanged = (event: { label: string; color: string }) => {
    emit('atl03CnfColorChanged', event);
  };
  
  function onDialogHide() {
    // If you need to do something on close of the popup, do it here.
    // e.g., reload color map, etc.
  }
  </script>
  
  <style scoped>
.legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px equivalent */
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem; /* 6px equivalent */
  white-space: nowrap; /* Keep text on a single line */
  overflow: hidden; /* Hide overflowing text */
  text-overflow: ellipsis; /* Add ellipsis for truncated text */
}

.color-box {
  width: 1rem; /* 16px equivalent */
  height: 1rem;
  border: 0.0625rem solid #000; /* 1px equivalent */
}

.label {
  font-size: 1rem; 
  line-height: 1.2; /* Adjust line height */
  color: white; /* Optional: Adjust color for subtle appearance */
}

.sr-legend-box {
    padding: 0.2rem; /* 3.2px equivalent */
    margin-top: 1rem;
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

/* Custom Fieldset legend style */
:deep(.sr-legend-box .p-fieldset-legend) {
    font-size: 0.75rem; /* Adjust font size */
    font-weight: normal; /* Optional: Adjust font weight */
    color:white; /* Adjust color */
    padding: 0.2rem; /* Adjust padding for a smaller appearance */
    text-align: center; /* Center text horizontally */
    position: absolute; /* Position relative to the Fieldset */
    top: 0.5rem; /* Align legend to the top */
    left: 50%; /* Center horizontally */
    transform: translate(-50%, -50%); /* Adjust position to center it over the top border */
    background:  black; /* Match the background color */
    z-index: 1; /* Ensure it appears above the Fieldset border */
    padding: 0 0.5rem; /* Add spacing to prevent overlap with text */
}
:deep(.p-fieldset-content-container) {
    padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}
</style>
  