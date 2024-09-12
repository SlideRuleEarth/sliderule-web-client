<template>
    <div class="tooltip" v-if="visible" :style="tooltipStyle">{{ text }}</div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  
  const visible = ref(false);
  const text = ref('');
  const tooltipStyle = ref({});
  
  // Define the functions that will control tooltip visibility and position
  const showTooltip = (event: MouseEvent, content: string) => {
    text.value = content;
    visible.value = true;
    const { clientX: x, clientY: y } = event;
    tooltipStyle.value = {
      top: `${y + 10}px`,
      left: `${x + 10}px`,
    };
  };
  
  const hideTooltip = () => {
    visible.value = false;
  };
  
  // Expose the functions so that the parent component can call them
  defineExpose({
    showTooltip,
    hideTooltip,
  });
  </script>
  
  <style scoped>
  .tooltip {
    position: absolute;
    background-color: #333;
    color: #fff;
    padding: 5px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 1000;
  }
  </style>
  