<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const sidebarWidth = ref(320); // default sidebar width in px
const isDragging = ref(false);

function startDrag() {
  isDragging.value = true;
}

function stopDrag() {
  isDragging.value = false;
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  // For example, we can set a lower limit of 200px and an upper limit of 600px
  const newWidth = Math.min(Math.max(event.clientX, 200), 1200);
  sidebarWidth.value = newWidth;
}

// Listen for mouse movements globally once dragging starts
onMounted(() => {
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
});
</script>

<template>
  <div class="layout-container">
    <div
      class="sidebar-col"
      :style="{ width: sidebarWidth + 'px' }"
    >
      <slot name="sidebar-col"></slot>
    </div>
    <div
      class="resizer"
      :class="{ dragging: isDragging }"
      @mousedown="startDrag"
    ></div>
    <main>
      <slot name="main"></slot>
    </main>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  position: relative;
  min-height: 60vh;
  /* 
    When hovering over the layout-container, 
    show the .resizer if not dragging.
  */
  &:hover .resizer:not(.dragging) {
    opacity: 1;
  }
}

/* Sidebar takes an explicit width from the ref. */
.sidebar-col {
  overflow-x: auto;
  /* Optional: add min or max width if desired: */
  min-width: 25rem; 
  max-width: 500rem;
}

/* Resizer handle */
.resizer {
  width: 5px;
  cursor: col-resize;
  background-color: var(--p-button-text-primary-color);;
  /* place it “on top” visually */
  z-index: 10;
  /* Initially hidden */
  opacity: 0;
  transition: opacity 0.3s ease;
}
 
/* If the resizer is actively being dragged, keep it visible */
.resizer.dragging {
  opacity: 1 !important;
}

main {
  flex: 1; /* take remaining space */
  overflow-y: auto;
}
</style>
