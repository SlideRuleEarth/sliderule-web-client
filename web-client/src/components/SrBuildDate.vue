<template>
  <div class="build-info-card">
    <h2>Build Information</h2>
    <ul>
      <li v-if="build_date"><strong>Build Date:</strong> {{ build_date }}</li>
      <li v-if="build_env"><strong>Build Env:</strong> {{ build_env }}</li>
      <li v-if="run_dev_date"><strong>Run Dev Date:</strong> {{ run_dev_date }}</li>
      <li v-if="live_update_date"><strong>Live Update:</strong> {{ live_update_date }}</li>
      <li v-if="client_version"><strong>Version:</strong> {{ client_version }}</li>
    </ul>
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
.build-info-card {
  max-width: 600px;
  margin: 0rem auto;
  padding: 0rem 1.5rem;
  border-radius: 12px;
  background-color: var(--surface-card);
  color: var(--p-primary-200);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  font-family: var(--font-family, Arial, sans-serif);
}

.build-info-card h2 {
  text-align: center;
  margin-bottom: 1rem;
  color: var(--p-primary-color);
}

.build-info-card ul {
  list-style-type: disc;
  padding-left: 2rem;
}

.build-info-card li {
  margin-bottom: 0.75rem;
  line-height: 1.5;
}
</style>
