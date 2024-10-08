<script setup lang="ts">
import { useDeviceStore } from '@/stores/deviceStore';
const deviceStore = useDeviceStore();


</script>

<template>
  <div>
    <h2>Navigator/User Agent Information</h2>
    <p><strong>Online Status:</strong> {{ deviceStore.getOnlineStatus() ? 'Online' : 'Offline' }}</p>
    <p><strong>Browser:</strong> {{ deviceStore.getBrowser() }}</p>
    <p><strong>Operating System:</strong> {{ deviceStore.getOS() }}</p>
    <p><strong>User Agent:</strong> {{ deviceStore.getUserAgent() }}</p>
    <p><strong>Language:</strong> {{ deviceStore.getLanguage() }}</p>
  </div>
</template>
