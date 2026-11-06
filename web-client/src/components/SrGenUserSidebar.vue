<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { onMounted, defineAsyncComponent } from 'vue'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
// eslint-disable-next-line @typescript-eslint/promise-function-async
const SrGenUserPresets = defineAsyncComponent(() => import('./SrGenUserPresets.vue'))

onMounted(() => {
  //console.log('Mounted SrGenUserSidebar');
  useMapStore().setPolySource('Draw on Map')
})
</script>

<template>
  <div class="sr-gen-user-sidebar-container">
    <SrGenUserPresets v-if="useSlideruleDefaults().fetched" />
  </div>
</template>

<style scoped>
.sr-gen-user-sidebar-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100vh;
}
</style>
