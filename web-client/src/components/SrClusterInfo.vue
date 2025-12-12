<template>
  <div class="sr-cluster-info">
    <div class="sr-cluster-field">
      <label>Type:</label>
      <span>{{ computedGetType }}</span>
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
import { useLegacyJwtStore } from '@/stores/SrLegacyJwtStore'

// Use the store
const sysConfigStore = useSysConfigStore()
const legacyJwtStore = useLegacyJwtStore()

// Computed properties to access state
const computedGetType = computed(() => {
  return legacyJwtStore.getIsPublic(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
    ? 'Public'
    : 'Private'
})
const currentNodes = computed(() => sysConfigStore.getCurrentNodes())
const version = computed(() => sysConfigStore.getVersion())
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
