<template>
  <div class="sr-build-date">
    <p>Build Date: {{ BUILD_DATE }}</p>
    <p>Upload Date: {{ UPLOAD_DATE }}</p>
    <p class="light">Version: {{ client_version }}</p>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { BUILD_DATE } from '@/buildDate.js';
import { UPLOAD_DATE } from '@/uploadDate.js';
const client_version = import.meta.env.VITE_APP_VERSION

</script>

<style scoped>
.sr-build-date {
  margin-top: 20px;
  font-size: 1.5em;
  text-align: center;
}
</style>

