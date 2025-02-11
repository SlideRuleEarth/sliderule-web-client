<template>
    <div class="sr-legend">
        <Fieldset
            class="sr-legend-box"
            legend="Atl03 Cnf Colors"
            :toggleable="false"
            :collapsed="false" 
        >
            <div v-for="option in atl03CnfOptions" :key="option.value" class="legend-item">
                <div class="color-box" :style="{ backgroundColor: getColorForAtl03CnfValue(option.value) }"></div>
                <div class="label">{{ formatLabel(option.label) }} ({{ option.value }})</div>
            </div>
        </Fieldset>  
    </div>
</template>
  
<script setup lang="ts">

import { onMounted, computed } from 'vue';
import { useColorMapStore } from '@/stores/colorMapStore';
import Fieldset from 'primevue/fieldset';
import { getColorForAtl03CnfValue } from '@/utils/colorUtils';

const emit = defineEmits(['restore-atl03-color-defaults-click', 'atl03CnfColorChanged']);
const colorMapStore = useColorMapStore();


onMounted(async () => {
    if (!colorMapStore.isInitialized) {
        await colorMapStore.initializeColorMapStore();
    }
});

const atl03CnfOptions = computed(() => colorMapStore.atl03CnfOptions);


const formatLabel = (label: string): string => {
    return label.replace(/^atl03_/, '').replace(/_/g, ' ');
};

</script>
  
<style scoped>
.sr-legend {
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
  