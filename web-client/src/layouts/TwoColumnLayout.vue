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
    min-width: 26rem; /* Default for larger screens */
    margin-right: 1rem;
    margin-left: 1rem;
    overflow-x: auto;
  }

  @media (max-width: 1200px) {
    .sidebar-col {
      min-width: 20rem; /* Adjust min-width for medium-sized screens */
    }
  }

  @media (max-width: 768px) {
    .sidebar-col {
      min-width: 16rem; /* Adjust for smaller screens */
    }
  }

  @media (max-width: 480px) {
    .sidebar-col {
      min-width: 12rem; /* Further adjust for very small screens */
    }
  }

  main {
    flex-grow: 8;
    overflow-y: auto; /* Add scrolling if content overflows */
  }
</style>
