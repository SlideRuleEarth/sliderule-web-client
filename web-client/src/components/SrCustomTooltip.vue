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
    const tooltipOffset = 10; // distance from the cursor
    // Estimate tooltip width based on the number of characters
    const averageCharWidth = 8; // Adjust this based on your font size
    const tooltipWidth = content.length * averageCharWidth;
    const tooltipHeight = 10; // estimated or actual height of your tooltip

    // Get the window's dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate the desired position
    let calculatedLeft = x + tooltipOffset;
    let calculatedTop = y + tooltipOffset;

    // Adjust position if the tooltip would be clipped horizontally
    if (calculatedLeft + tooltipWidth > windowWidth) {
      calculatedLeft = x - tooltipWidth - tooltipOffset;
    }

    // Adjust position if the tooltip would be clipped vertically
    if (calculatedTop + tooltipHeight > windowHeight) {
      calculatedTop = y - tooltipHeight - tooltipOffset;
    }

    // Apply the calculated position
    tooltipStyle.value = {
      top: `${calculatedTop}px`,
      left: `${calculatedLeft}px`,
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
  