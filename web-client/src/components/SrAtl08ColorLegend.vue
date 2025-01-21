<template>
    <div class="legend">
        <!-- Existing ATL08 class color items -->
        <Fieldset
            class="sr-legend-box"
            legend="ATL08 Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div  v-for="option in atl08ClassOptions"  :key="option.value" class="legend-item" >
                <div  class="color-box"  :style="{ backgroundColor: getColorForAtl08ClassValue(option.value) }" ></div>
                <div class="label"> {{ formatLabel(option.label) }} ({{ option.value }}) </div>
            </div>
        </Fieldset>
        <!-- New Manage Colors button -->
        <div class="sr-restore-defaults">
            <Button label="Manage Atl08 Colors" @click="showDialog = true" size="small" />
        </div>
  
        <!-- Dialog that contains SrAtl03CnfColors when visible -->
        <Dialog
            v-model:visible="showDialog"
            :modal="true"
            :draggable="false"
            :resizable="false"
            header="Manage ATL08 Colors"
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
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import Fieldset from 'primevue/fieldset';

const emit = defineEmits(['restore-atl08-color-defaults-click', 'atl08ClassColorChanged']);

const store = useAtl03ColorMapStore();

// Dialog visibility state
const showDialog = ref(false);

onMounted(async () => {
    if (!store.isInitialized) {
        await store.initializeAtl03ColorMapStore();
    }
});

const atl08ClassOptions = computed(() => store.atl08ClassOptions);

const getColorForAtl08ClassValue = (value: number): string => {
    return store.getColorForAtl08ClassValue(value);
};

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
</style>
  