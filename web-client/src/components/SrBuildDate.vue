<template>
  <div>
    <h2>Build Information</h2>
    <p v-if="build_date"><strong>Build Date:</strong> {{ build_date }}</p>
    <p v-if="build_env"><strong>Build Env:</strong> {{ build_env }}</p>
    <p v-if="run_dev_date"><strong>Run Dev Date:</strong> {{ run_dev_date }}</p>
    <p v-if="live_update_date"><strong>Live Update:</strong> {{ live_update_date }}</p>
    <p v-if="client_version"><strong>Version:</strong> {{ client_version }}</p>
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

</style>

