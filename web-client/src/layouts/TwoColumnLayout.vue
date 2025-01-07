<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const sidebarWidth = ref(window.innerWidth * 0.5); // 50% of viewport width initially
const isDragging = ref(false);

function startDrag() {
  isDragging.value = true;
}

function stopDrag() {
  isDragging.value = false;
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;

  // Ensure the sidebar width stays within reasonable bounds
  const newWidth = Math.min(Math.max(event.clientX, 200), window.innerWidth - 200);
  sidebarWidth.value = newWidth;
}

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
      class="resizer-hotzone"
      @mousedown="startDrag"
    >
      <div
        class="resizer"
        :class="{ dragging: isDragging }"
      ></div>
    </div>

    <main :style="{ width: `calc(100% - ${sidebarWidth}px)` }">
      <slot name="main"></slot>
    </main>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  min-height: 60vh;
}

/* The sidebar column starts with 50% width */
.sidebar-col {
  overflow-x: auto;
  min-width: 200px;
  max-width: 80%;
}

/* Resizer styles */
.resizer-hotzone {
  width: 15px;
  cursor: col-resize;
  position: relative;
  z-index: 10;
}

.resizer {
  width: 5px;
  height: 100%;
  margin-left: 5px;
  background-color: var(--p-button-text-primary-color);
  transition: opacity 0.3s ease;
  opacity: 0;
}

.resizer-hotzone:hover .resizer:not(.dragging),
.resizer.dragging {
  opacity: 1 !important;
}

/* The main content area */
main {
  overflow-y: auto;
}
</style>
