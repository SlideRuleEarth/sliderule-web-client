<script setup lang="ts">
import { computed, watch } from 'vue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { storeToRefs } from 'pinia'

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()

// Use storeToRefs for reactive two-way binding
const { domain, clusterName } = storeToRefs(deployConfigStore)

// Use accessibleClusters directly from the store
const clusterOptions = computed(() => githubAuthStore.deployableClusters || [])

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
  <Fieldset legend="Deployment" toggleable>
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
  </Fieldset>
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
