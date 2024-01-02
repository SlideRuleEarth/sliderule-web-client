<script setup lang="ts">
</script>

<template>
  <div class="single-column-layout">
    <header>
      <slot name = "sr-sidebar-header"></slot>
    </header>

  </div>
</template>

<style scoped>
.single-column-layout {
  display: flex;
  @media (max-width: 768px) {
    flex-direction: column;
  }
}
header {
  flex-basis: 20%;
  margin-top: 30px;
}

main {
  flex-basis: 80%;
  margin-top: 10px;
  padding: 20px;
}
</style>
