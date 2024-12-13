<script setup lang="ts">
</script>

<template>
  <div class="single-column-layout">
    <main>
      <slot name = "sr-single-col"></slot>
    </main>

  </div>
</template>

<style scoped>
.single-column-layout {
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

main {
  width: fit-content;
  overflow-x: auto;
}
</style>
