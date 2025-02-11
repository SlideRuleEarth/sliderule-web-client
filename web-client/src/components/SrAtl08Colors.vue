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
    </div>
</template>
  
<script setup lang="ts">

import { onMounted, computed } from 'vue';
import { useColorMapStore } from '@/stores/colorMapStore';
import Fieldset from 'primevue/fieldset';
import { getColorForAtl08ClassValue } from '@/utils/colorUtils';

const emit = defineEmits(['restore-atl08-color-defaults-click', 'atl08ClassColorChanged']);

const colorMapStore = useColorMapStore();

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
  