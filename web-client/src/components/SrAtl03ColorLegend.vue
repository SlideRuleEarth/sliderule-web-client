<template>
    <div class="legend">
      <div 
        v-for="option in atl03CnfOptions" 
        :key="option.value" 
        class="legend-item"
      >
        <div 
          class="color-box" 
          :style="{ backgroundColor: getColorForAtl03CnfValue(option.value) }"
        ></div>
        <div class="label">
          {{ formatLabel(option.label) }} ({{ option.value }})
        </div>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, onMounted } from 'vue';
  import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
  
  export default defineComponent({
    name: 'Atl03CnfLegend',
    setup() {
      const store = useAtl03ColorMapStore();
  
      onMounted(async () => {
        if (!store.isInitialized) {
          await store.initializeAtl03ColorMapStore();
        }
      });
  
      const getColorForAtl03CnfValue = (value: number) => {
        return store.getColorForAtl03CnfValue(value);
      };
  
      // Function to format the label
      const formatLabel = (label: string) => {
        return label.replace(/^atl03_/, '').replace(/_/g, ' ');
      };
  
      return {
        atl03CnfOptions: store.atl03CnfOptions,
        getColorForAtl03CnfValue,
        formatLabel,
      };
    },
  });
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
  