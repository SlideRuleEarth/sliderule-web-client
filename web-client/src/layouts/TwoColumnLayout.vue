<script setup lang="ts">
</script>

<template>
  <div class="two-column-layout">
    <header>
      <slot name = "header"></slot>
    </header>
    <main>
      <slot name = "main"></slot>
    </main>
  </div>
</template>

<style scoped>
.two-column-layout {
  display: flex;
  @media (max-width: 768px) {
    flex-direction: column;
  }
}
header {
  flex-basis: 20%;
  margin-top: 0.5rem;
  bottom: 0;
}

main {
  flex-basis: 80%;
  margin-top: 0.5rem;
  padding: 1 rem;
  border-radius: 2rem;
}
</style>
