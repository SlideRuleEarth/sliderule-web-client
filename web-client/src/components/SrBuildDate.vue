<template>
  <div class="sr-build-date">
    <p>Build Date: {{ BUILD_DATE }}</p>
    <p>Upload Date: {{ UPLOAD_DATE }}</p>
    <p>Run Dev Date: {{ RUN_DEV_DATE }}</p>
    <p class="light">Version: {{ client_version }}</p>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { BUILD_DATE } from '@/buildDate';
import { UPLOAD_DATE } from '@/uploadDate';
import { RUN_DEV_DATE } from '@/runDevDate';
const client_version = import.meta.env.VITE_APP_VERSION

</script>

<style scoped>
.sr-build-date {
  margin-top: 20px;
  font-size: 1.5em;
  text-align: center;
}
</style>

