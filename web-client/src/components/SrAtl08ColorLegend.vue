<template>
    <div class="legend">
      <div 
        v-for="option in atl08ClassOptions" 
            :key="option.value" 
            class="legend-item"
        >
        <div 
          class="color-box" 
          :style="{ backgroundColor: getColorForAtl08ClassValue(option.value) }"
        ></div>
        <div class="label">
          {{ formatLabel(option.label) }} ({{ option.value }})
        </div>
      </div>
    </div>
</template>
  
<script setup lang="ts">

import {onMounted,computed } from 'vue';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
const store = useAtl03ColorMapStore();
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
  return label.replace(/^atl03_/, '').replace(/_/g, ' ');
};
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
  