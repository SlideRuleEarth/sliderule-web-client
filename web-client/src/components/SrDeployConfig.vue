<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { useClusterReachability } from '@/composables/useClusterReachability'
import { storeToRefs } from 'pinia'

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()

// Use storeToRefs for reactive two-way binding
const { domain, clusterName, desiredVersion, currentNodes, canConnectNodes } =
  storeToRefs(deployConfigStore)

// Use deployableClusters directly from the store (exclude "*" wildcard from dropdown)
const clusterList = computed(() =>
  (githubAuthStore.deployableClusters || []).filter((c) => c !== '*')
)

// Check if deployableClusters contains wildcard "*" to enable editable mode
const allowCustomCluster = computed(
  () => githubAuthStore.deployableClusters?.includes('*') ?? false
)

// Use composable for cluster reachability
const { refreshClusterReachability } = useClusterReachability(clusterList, domain)

async function refreshStatus() {
  deployConfigStore.resetStatus()
  if (clusterName.value) {
    await Promise.all([
      deployConfigStore.fetchServerVersionInfo(),
      deployConfigStore.fetchCurrentNodes()
    ])
  }
}

// Transform cluster options to include disabled state and status label
const clusterOptionsWithStatus = computed(() => {
  return clusterList.value.map((c) => {
    const statusLabel = deployConfigStore.getStackStatusLabel(c)
    return {
      label: statusLabel ? `${c} (${statusLabel})` : c,
      value: c,
      disabled: deployConfigStore.isClusterDisabled(c)
    }
  })
})

// Refresh stack status and reachability for all clusters when dropdown opens
async function refreshClusterStatus() {
  await Promise.all([
    deployConfigStore.refreshAllClusterStatus(clusterList.value),
    refreshClusterReachability()
  ])
}

// Set default cluster name when options become available
watch(
  clusterList,
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
  <Fieldset legend="Deployment" toggleable :collapsed="true">
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
          :editable="allowCustomCluster"
          :options="clusterOptionsWithStatus"
          optionLabel="label"
          optionValue="value"
          optionDisabled="disabled"
          class="sr-deploy-select"
          @show="refreshClusterStatus"
        />
      </div>
      <div class="sr-deploy-field">
        <label for="deploy-version" class="sr-deploy-label">Version</label>
        <InputText
          id="deploy-version"
          v-model="desiredVersion"
          placeholder="latest"
          class="sr-deploy-input"
        />
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
          class="sr-glow-button"
          variant="text"
          rounded
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

.sr-deploy-input {
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
