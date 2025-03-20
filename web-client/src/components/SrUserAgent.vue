<script setup lang="ts">
import { useDeviceStore } from '@/stores/deviceStore';
const deviceStore = useDeviceStore();
</script>

<template>
  <div class="device-info-card">
    <h2>Navigator / User Agent Information</h2>
    <ul>
      <li><strong>Online Status:</strong> {{ deviceStore.getOnlineStatus() ? 'Online' : 'Offline' }}</li>
      <li><strong>Browser:</strong> {{ deviceStore.getBrowser() }}</li>
      <li><strong>Operating System:</strong> {{ deviceStore.getOS() }}</li>
      <li><strong>User Agent:</strong> {{ deviceStore.getUserAgent() }}</li>
      <li><strong>Language:</strong> {{ deviceStore.getLanguage() }}</li>
      <li><strong>WebGL:</strong> {{ deviceStore.getWebGLSupported() ? 'Supported' : 'Not Supported' }}</li>
    </ul>
  </div>
</template>

<style scoped>
.device-info-card {
  max-width: 50vw;
  margin: 0rem auto;
  padding: 1.5rem;
  border-radius: 12px;
  background-color: var(--surface-card);
  color: var(--p-primary-200);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  font-family: var(--font-family, Arial, sans-serif);
}

.device-info-card h2 {
  text-align: center;
  margin-bottom: 1rem;
  color: var(--p-primary-color);
}

.device-info-card ul {
  list-style-type: disc;
  padding-left: 2rem;
}

.device-info-card li {
  margin-bottom: 0.75rem;
  line-height: 1.5;
}
</style>
