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
  // For example, clamp between 200px and 1200px
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

    <!-- 
      The "hot zone" wrapper (wider area) 
      that displays the actual resizer only on hover or drag 
    -->
    <div
      class="resizer-hotzone"
      @mousedown="startDrag"
    >
      <div
        class="resizer"
        :class="{ dragging: isDragging }"
      ></div>
    </div>

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
}

/* The sidebar width is driven by sidebarWidth. */
.sidebar-col {
  overflow-x: auto;
  min-width: 25rem; 
  max-width: 500rem;
}

/* 
  The "hot zone" is a transparent strip that's wider than 
  the actual resizer. This makes it easier for the user 
  to hover near the boundary without pixel-perfect aiming.
*/
.resizer-hotzone {
  width: 15px; /* or however wide you want the 'hover area' to be */
  cursor: col-resize;
  /* place it visually on top so it captures mouse events */
  z-index: 10;
  position: relative;
}

/*
  The actual resizer bar is narrower (e.g. 5px) 
  and is placed within the hotzone.
*/
.resizer {
  width: 5px;
  height: 100%;
  margin-left: 5px; /* center the resizer inside the 15px hotzone */
  background-color: var(--p-button-text-primary-color);
  transition: opacity 0.3s ease;
  
  /* Start hidden */
  opacity: 0;
}

/* When hovering over the hotzone (unless dragging), show the resizer. */
.resizer-hotzone:hover .resizer:not(.dragging) {
  opacity: 1;
}

/* If the user is actively dragging, keep the resizer visible. */
.resizer.dragging {
  opacity: 1 !important;
}

main {
  flex: 1; /* take remaining space */
  overflow-y: auto;
}
</style>
