<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Define reactive variables for navigator info
const userAgent = ref('');
const language = ref('');
const online = ref(false);

// Function to extract navigator information
const getNavigatorInfo = () => {
    console.log('getNavigatorInfo navigator:', navigator);
    userAgent.value = navigator.userAgent;
    language.value = navigator.language;
    online.value = navigator.onLine;
};

// Run navigator detection after component is mounted
onMounted(() => {
    getNavigatorInfo();
});
</script>

<template>
  <div>
    <h2>Navigator Information</h2>
    <p><strong>User Agent:</strong> {{ userAgent }}</p>
    <p><strong>Language:</strong> {{ language }}</p>
    <p><strong>Online Status:</strong> {{ online ? 'Online' : 'Offline' }}</p>
  </div>
</template>
