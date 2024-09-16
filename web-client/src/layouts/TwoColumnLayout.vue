<script setup lang="ts">
</script>

<template>
  <div class="two-column-layout">
    <div class="sidebar-col">
      <slot name = "sidebar-col"></slot>
    </div>
    <main>
      <slot name = "main"></slot>
    </main>
  </div>
</template>

<style scoped>
  .two-column-layout {
    display: flex;
    min-height: 60vh;
    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  .sidebar-col {
    flex-grow: 1;
    flex-basis: 20%;
    flex-direction: column;
    align-items: center;
    min-width: 31rem;
    padding: 1rem;
  }

  main {
    flex-grow: 8;
    padding: 1 rem;
    overflow-y: auto; /* Add scrolling if content overflows */
  }
</style>
