<template>
  <div>
    <p>Build Date: {{ BUILD_DATE }}</p>
    <p>Upload Date: {{ UPLOAD_DATE }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { BUILD_DATE } from '@/buildDate.js';
import { UPLOAD_DATE } from '@/uploadDate.js';
</script>
