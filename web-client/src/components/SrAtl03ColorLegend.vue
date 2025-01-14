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
    gap: 8px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .color-box {
    width: 20px;
    height: 20px;
    border: 1px solid #000;
  }
  
  .label {
    font-size: 14px;
  }
  
  .sr-restore-defaults {
    margin-top: 1rem;
  }

  .sr-legend-box {
    padding: 0.3125rem;
    border-radius: var(--p-border-radius);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  </style>
  