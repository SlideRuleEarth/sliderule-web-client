<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Select from 'primevue/select'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'

const githubAuthStore = useGitHubAuthStore()

// Local refs for deployment configuration
const domain = ref('slideruleearth.io')
const clusterName = ref('')

// Compute deploy cluster options: username, then teams (with -cluster suffix)
const clusterOptions = computed(() => {
  const options: string[] = []
  if (githubAuthStore.username) {
    options.push(`${githubAuthStore.username}-cluster`)
  }
  if (githubAuthStore.teams && githubAuthStore.teams.length > 0) {
    options.push(...githubAuthStore.teams.map((team) => `${team}-cluster`))
  }
  return options
})

// Set default cluster name when options become available
watch(
  clusterOptions,
  (options) => {
    if (!clusterName.value && options.length > 0) {
      clusterName.value = options[0]
    }
  },
  { immediate: true }
)

// Available domain options
const domainOptions = ['testsliderule.org', 'slideruleearth.io']

// Only owners can change domain
const isDomainDisabled = computed(() => !githubAuthStore.isOwner)
</script>

<template>
  <div class="sr-deploy-config">
    <div class="sr-deploy-field">
      <label for="deploy-domain" class="sr-deploy-label">Domain</label>
      <Select
        id="deploy-domain"
        v-model="domain"
        :options="domainOptions"
        :disabled="isDomainDisabled"
        class="sr-deploy-select"
      />
    </div>
    <div class="sr-deploy-field">
      <label for="deploy-cluster" class="sr-deploy-label">Cluster</label>
      <Select
        id="deploy-cluster"
        v-model="clusterName"
        :options="clusterOptions"
        class="sr-deploy-select"
      />
    </div>
  </div>
</template>

<style scoped>
.sr-deploy-config {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.sr-deploy-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-deploy-label {
  font-size: small;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.sr-deploy-select {
  width: 15em;
}
</style>
