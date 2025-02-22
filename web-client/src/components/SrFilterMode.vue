<template>
    <div class="sr-filter-modes">
        <div v-for="filterMode in globalChartStore.filterModeOptions" :key="filterMode.key" class="sr-filter-mode-item">
            <RadioButton v-model="filterModeReactive" :inputId="filterMode.key" name="dynamic" :value="filterMode.name" size="small" />
            <label :for="filterMode.key">{{ filterMode.name }}</label>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import RadioButton from 'primevue/radiobutton';
    import { useGlobalChartStore } from '@/stores/globalChartStore';
    import { filterModeReactive } from '@/utils/plotUtils';
    const globalChartStore = useGlobalChartStore();

  // Access the global store
  
  
</script>
<style scoped>
    .sr-filter-modes {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem; /* Adds spacing between items */
        margin-bottom: 0.5rem;
        font-size: small;
    }
    
    .sr-filter-mode-item {
        display: flex;
        align-items: center;
        gap: 0.5rem; /* Space between the radio button and label */
    }
</style>
  