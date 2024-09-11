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
    margin-top: 0.5rem;
    flex-direction: column;
    align-items: center;
    min-width: 30rem;
  }

  main {
    flex-grow: 8;
    margin-top: 0.5rem;
    padding: 1 rem;
    border-radius: 2rem;
    overflow-y: auto; /* Add scrolling if content overflows */
  }
</style>
