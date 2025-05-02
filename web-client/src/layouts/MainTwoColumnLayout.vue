<script setup lang="ts">
// No script needed unless you want to detect view state dynamically
</script>

<template>
  <div class="two-column-layout">
    <div class="sidebar-col">
      <slot name="sidebar-col" />
    </div>
    <main class="main-col">
      <slot name="main" />
    </main>
  </div>
</template>

<style scoped>
.two-column-layout {
  display: flex;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
}

/* Sidebar: scrollable and fixed width */
.sidebar-col {
  flex: 0 0 25rem;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

/* Main content: fills remaining space */
.main-col {
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 767px) {

  .sidebar-col,
  .main-col {
    width: 100%;
    height: auto;
    min-width: 0;
  }

  .main-col {
    flex: 1;
  }
}

@media screen and (max-width: 767px) and (orientation: portrait) {
  .two-column-layout {
    flex-direction: column;
  }

  .sidebar-col,
  .main-col {
    width: 100%;
    height: auto;
    min-width: 0;
  }
}


</style>
