<script setup lang="ts">
import { computed } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useJwtStore } from '@/stores/SrJWTStore'

const githubAuthStore = useGitHubAuthStore()
const sysConfigStore = useSysConfigStore()
const jwtStore = useJwtStore()

// Compute cluster options: sliderule first, then username, then teams (with -cluster suffix)
const clusterOptions = computed(() => {
  const options: string[] = ['sliderule']
  if (githubAuthStore.username) {
    options.push(`${githubAuthStore.username}-cluster`)
  }
  if (githubAuthStore.teams && githubAuthStore.teams.length > 0) {
    options.push(...githubAuthStore.teams.map((team) => `${team}-cluster`))
  }
  return options
})

// Available domain options
const domainOptions = ['testsliderule.org', 'slideruleearth.io']

// Reset to public cluster
async function resetToPublicCluster() {
  jwtStore.clearAllJwts()
  sysConfigStore.$reset()
  // Set defaults: slideruleearth.io and sliderule
  sysConfigStore.setDomain('slideruleearth.io')
  sysConfigStore.setOrganization('sliderule')
  await sysConfigStore.fetchServerVersionInfo()
  await sysConfigStore.fetchCurrentNodes()
}
</script>

<template>
  <div class="sr-sysconfig">
    <div class="sr-sysconfig-field">
      <label for="sysconfig-domain" class="sr-sysconfig-label">Domain</label>
      <Select
        id="sysconfig-domain"
        v-model="sysConfigStore.domain"
        :options="domainOptions"
        class="sr-sysconfig-select"
      />
    </div>
    <div class="sr-sysconfig-field">
      <label for="sysconfig-cluster" class="sr-sysconfig-label">Cluster</label>
      <Select
        id="sysconfig-cluster"
        v-model="sysConfigStore.organization"
        :options="clusterOptions"
        class="sr-sysconfig-select"
      />
    </div>
    <div class="sr-sysconfig-button-row">
      <Button
        label="Reset to Public Cluster"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        @click="resetToPublicCluster"
      />
    </div>
  </div>
</template>

<style scoped>
.sr-sysconfig {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.sr-sysconfig-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-sysconfig-label {
  font-size: small;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.sr-sysconfig-select {
  width: 15em;
}

.sr-sysconfig-button-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
</style>
