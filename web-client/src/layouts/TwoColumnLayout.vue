<script setup lang="ts">
</script>

<template>
  <div class="two-column-layout">
    <div>
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
    min-height: 90vh;
    @media (max-width: 768px) {
      flex-direction: column;
    }
  }
  .sidebar-col {
    flex-basis: 20%;
    margin-top: 0.5rem;
    bottom: 0.5rem;
  }

  main {
    flex-basis: 80%;
    margin-top: 0.5rem;
    padding: 1 rem;
    border-radius: 2rem;
  }
</style>
