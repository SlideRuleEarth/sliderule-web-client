<template>
  <Teleport to="body">
    <div class="tooltip" v-if="visible" :style="tooltipStyle">{{ text }}</div>
  </Teleport>
</template>
  
  <script setup lang="ts">
  import { ref  } from 'vue';
  import { Teleport } from 'vue';
  
  const visible = ref(false);
  const text = ref('');
  const tooltipStyle = ref({});
  

  // Define the functions that will control tooltip visibility and position
  const showTooltip = (event: MouseEvent, content: string | undefined) => {
    if (!content) {
        console.warn('Tooltip content is undefined or empty content:', content);
        console.log('Tooltip event:', event);
        return;
    }
    
    text.value = content;
    visible.value = true;

    const { clientX: x, clientY: y } = event;
    const tooltipOffset = 10; // distance from the cursor
 
    const fontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
    const tooltipWidth = (content?.length ?? 0) * fontSizePx * 0.6; // heuristic
    const tooltipHeight = 24; // better estimate

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = x + tooltipOffset;
    let top = y + tooltipOffset;

    if (left + tooltipWidth > windowWidth) {
        left = x - tooltipWidth - tooltipOffset;
    }
    if (top + tooltipHeight > windowHeight) {
        top = y - tooltipHeight - tooltipOffset;
    }

    // Prevent negative values
    left = Math.max(0, left);
    top = Math.max(0, top);
    // Apply the calculated position
    tooltipStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
    };
    // console.log(`Tooltip {content} position:`, {
    //   top: `${top}px`,
    //   left: `${left}px`
    // });
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
    z-index: 1000;
    max-width: 15rem;
    overflow: visible;
  }
  </style>
  