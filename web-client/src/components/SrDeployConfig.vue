<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { storeToRefs } from 'pinia'

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()

// Use storeToRefs for reactive two-way binding
const { domain, clusterName, version, currentNodes, canConnectVersion, canConnectNodes } =
  storeToRefs(deployConfigStore)

async function refreshStatus() {
  deployConfigStore.resetStatus()
  if (clusterName.value) {
    await Promise.all([
      deployConfigStore.fetchServerVersionInfo(),
      deployConfigStore.fetchCurrentNodes()
    ])
  }
}

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

// Refresh status when domain or clusterName changes
watch([domain, clusterName], () => {
  void refreshStatus()
})

// Fetch status on mount
onMounted(() => {
  void refreshStatus()
})

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
      <div class="sr-deploy-field">
        <label class="sr-deploy-label">Version</label>
        <span :class="['sr-deploy-value', `sr-status-${canConnectVersion}`]">
          {{ version || 'v?.?.?' }}
        </span>
      </div>
      <div class="sr-deploy-field">
        <label class="sr-deploy-label">Current Nodes</label>
        <span :class="['sr-deploy-value', `sr-status-${canConnectNodes}`]">
          {{ currentNodes >= 0 ? currentNodes : '-' }}
        </span>
      </div>
      <div class="sr-deploy-actions">
        <Button
          label="Refresh Status"
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          :disabled="!clusterName"
          @click="refreshStatus"
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

.sr-deploy-value {
  font-size: small;
  min-width: 15em;
  text-align: right;
}

.sr-status-yes {
  color: var(--p-green-500);
}

.sr-status-no {
  color: var(--p-red-500);
}

.sr-status-unknown {
  color: var(--p-text-muted-color);
}

.sr-deploy-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
</style>
