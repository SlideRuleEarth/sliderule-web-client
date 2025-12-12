<template>
  <div class="sr-cluster-info">
    <div class="sr-cluster-field">
      <label>Type:</label>
      <span>TBD</span>
    </div>
    <div class="sr-cluster-field">
      <label>Current Nodes:</label>
      <span>{{ currentNodes }}</span>
    </div>
    <div class="sr-cluster-field">
      <label>Version:</label>
      <span>{{ version }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSysConfigStore } from '@/stores/sysConfigStore'

// Use the store
const sysConfigStore = useSysConfigStore()

const currentNodes = computed(() => sysConfigStore.current_nodes)
const version = computed(() => sysConfigStore.version)
</script>

<style scoped>
.sr-cluster-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-cluster-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-cluster-field label {
  font-size: small;
  white-space: nowrap;
  margin-right: 0.5rem;
}
</style>
