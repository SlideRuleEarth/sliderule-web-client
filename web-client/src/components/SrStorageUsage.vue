<template>
  <div class="sr-storage-panel">
    <h2 class="sr-storage-panel-header">Storage Quota</h2>
    <div class="sr-storage-panel-content">
      <span>Total Quota: {{ formatBytes(storageEstimate.quota) }}</span>
      <span>Total Used: {{ formatBytes(storageEstimate.usage) }}</span>
      <span>Percentage Used: {{ percentageUsed.toFixed(2) }}%</span>
      <div class="sr-storage-panel-bb">
        <Button size="small" label="Refresh" @click="fetchStorageEstimate"></Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';

const storageEstimate = ref({ quota: 0, usage: 0 });

const fetchStorageEstimate = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    storageEstimate.value.quota = estimate.quota ?? 0;
    storageEstimate.value.usage = estimate.usage ?? 0;
  }
};

onMounted(() => {
  fetchStorageEstimate();
});

const percentageUsed = computed(() => {
  if (storageEstimate.value.quota > 0) {
    return (storageEstimate.value.usage / storageEstimate.value.quota) * 100;
  }
  return 0;
});

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
</script>

<style>
/* Style your button and component here */
.sr-storage-panel {
  display: flex;
  flex-direction: column;
  padding: 0.0125rem;
  margin-top: 1rem;
}
.sr-storage-panel-header {
  display: flex;
  margin-top: 0;
  font-size: medium;
  font-weight: bold;
  justify-content: center;
}
.sr-storage-panel-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  font-size: smaller;
  padding: 0.25rem;
}
.sr-storage-panel-bb {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}
</style>
