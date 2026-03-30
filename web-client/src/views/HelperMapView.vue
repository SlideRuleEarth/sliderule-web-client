<script setup lang="ts">
import SrHelperMap from '@/components/SrHelperMap.vue'
</script>

<template>
  <div class="helper-map-layout">
    <main class="helper-map-main">
      <SrHelperMap />
    </main>
  </div>
</template>

<style scoped>
.helper-map-layout {
  display: flex;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
}

.helper-map-main {
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
