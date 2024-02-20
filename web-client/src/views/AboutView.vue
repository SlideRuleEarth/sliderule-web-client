<script setup>
const client_version = import.meta.env.VITE_APP_VERSION
</script>

<template>
  <div class="about">
    <h1 class="light">Version: {{ client_version }}</h1>
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
