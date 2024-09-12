<template>
  <div class="sr-build-date">
    <span v-if="build_date">Build Date: {{ build_date }}</span>
    <span v-if="build_env">Build Env: {{ build_env }}</span>
    <span v-if="run_dev_date">Run Dev Date: {{ run_dev_date }}</span>
    <span v-if="live_update_date">Live Update: {{ live_update_date }}</span>
    <span v-if="client_version">Version: {{ client_version }}</span>
  </div>
</template>

<script setup lang="ts">

const build_date = import.meta.env.VITE_APP_BUILD_DATE
const build_env = import.meta.env.VITE_BUILD_ENV
const run_dev_date = import.meta.env.VITE_RUN_DEV_DATE
const live_update_date = import.meta.env.VITE_LIVE_UPDATE_DATE
const client_version = import.meta.env.VITE_APP_VERSION



</script>

<style scoped>
.sr-build-date {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  font-size: 1.5em;
  text-align: center;
}
</style>

