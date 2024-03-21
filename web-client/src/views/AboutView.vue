<script setup>
  import SrBuildDate from '@/components/SrBuildDate.vue';
  const client_version = import.meta.env.VITE_APP_VERSION
</script>

<template>
  <div class="about">
    <SrBuildDate />
    <p class="light">Version: {{ client_version }}</p>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
