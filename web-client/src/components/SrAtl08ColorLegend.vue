<template>
    <div class="sr-legend">
        <Fieldset
            class="sr-legend-box"
            legend="ATL08 Class Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div  v-for="option in atl08ClassOptions"  :key="option.value" class="legend-item" >
                <div  class="color-box"  :style="{ backgroundColor: getColorForAtl08ClassValue(option.value) }" ></div>
                <div class="label"> {{ formatLabel(option.label) }} ({{ option.value }}) </div>
            </div>
        </Fieldset>
        <div class="sr-restore-defaults">
            <Button label="Manage Atl08 Class Colors" @click="showDialog = true" size="small" />
        </div>
  
        <Dialog
            v-model:visible="showDialog"
            :modal="true"
            :draggable="false"
            :resizable="false"
            header="Manage Atl08 Class Colors"
            @hide="onDialogHide"
        >
            <SrAtl08ClassColors
                @selectionChanged="atl08ClassColorChanged"
                @defaultsChanged="atl08ClassColorChanged"
            />
        </Dialog>        
    </div>
</template>
  
<script setup lang="ts">

import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SrAtl08ClassColors from './SrAtl08ClassColors.vue';
import { useColorMapStore } from '@/stores/colorMapStore';
import Fieldset from 'primevue/fieldset';
import { getColorForAtl08ClassValue } from '@/utils/colorUtils';

const emit = defineEmits(['restore-atl08-color-defaults-click', 'atl08ClassColorChanged']);

const colorMapStore = useColorMapStore();

// Dialog visibility state
const showDialog = ref(false);

onMounted(async () => {
    if (!colorMapStore.isInitialized) {
        await colorMapStore.initializeColorMapStore();
    }
});

const atl08ClassOptions = computed(() => colorMapStore.atl08ClassOptions);


// Function to format the label
const formatLabel = (label: string): string => {
  return label.replace(/^atl08_/, '').replace(/_/g, ' ');
};

// Emitted when a color changes
const atl08ClassColorChanged = (event: { label: string; color: string }) => {
    emit('atl08ClassColorChanged', event);
};

function onDialogHide() {
    // If you need to do something on close of the popup, do it here.
    // e.g., reload color map, etc.
}


</script>
  
  <style scoped>
  .sr-legend {
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

  .sr-legend-box {
    padding: 0.2rem; /* 3.2px equivalent */
    margin-top: 1rem;
    border-radius: var(--p-border-radius);
    position: relative; /* Enable positioning for the legend */
}

/* Custom Fieldset legend style */
:deep(.sr-legend-box .p-fieldset-legend) {
    font-size: small;
    font-weight: normal;
    color: white;
    padding: 0.2rem;
    text-align: center;
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translate(-50%, -50%);
    background: black;
    border-radius: 0.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1;
    padding: 0 0.5rem;
}
:deep(.p-fieldset-content-container) {
    padding-top: 1.5rem; /* Adjust padding to prevent overlap with the legend */
}
</style>
  