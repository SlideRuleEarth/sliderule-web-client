<script setup lang="ts">
import SrReqDisplay from './SrReqDisplay.vue'
import { useRequestMapStore } from '@/stores/requestMapStore'
import { onMounted, defineAsyncComponent } from 'vue'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
// eslint-disable-next-line @typescript-eslint/promise-function-async
const SrGenUserPresets = defineAsyncComponent(() => import('./SrGenUserPresets.vue'))

onMounted(() => {
  //console.log('Mounted SrGenUserSidebar');
  useRequestMapStore().setPolySource('Draw on Map')
})
</script>

<template>
  <div class="sr-gen-user-sidebar-container">
    <div class="sr-gen-user-wrapper">
      <SrReqDisplay />
    </div>
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
.sr-gen-user-wrapper {
  margin-top: 0.25rem;
}
</style>
