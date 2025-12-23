<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import SrClusterStackStatus from '@/components/SrClusterStackStatus.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { deployCluster } from '@/utils/fetchUtils'
import { storeToRefs } from 'pinia'

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()

// Use storeToRefs for reactive two-way binding
const { domain, clusterName, desiredVersion } = storeToRefs(deployConfigStore)

// Use deployableClusters directly from the store (exclude "*" wildcard from dropdown)
const clusterList = computed(() =>
  (githubAuthStore.deployableClusters || []).filter((c) => c !== '*')
)

// Check if deployableClusters contains wildcard "*" to enable editable mode
const allowCustomCluster = computed(
  () => githubAuthStore.deployableClusters?.includes('*') ?? false
)

async function refreshStatus() {
  deployConfigStore.resetStatus()
  if (clusterName.value) {
    await deployConfigStore.fetchServerVersionInfo()
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

// Deploy state
const deploying = ref(false)
const deployedCluster = ref<string | null>(null)
const deployError = ref<string | null>(null)

async function handleDeploy() {
  if (!clusterName.value) return

  deploying.value = true
  deployError.value = null
  deployedCluster.value = null

  try {
    const result = await deployCluster(clusterName.value)
    if (result.success && result.data?.status) {
      deployedCluster.value = clusterName.value
    } else {
      deployError.value = result.error ?? 'Deploy failed'
    }
  } catch (e) {
    deployError.value = e instanceof Error ? e.message : String(e)
  } finally {
    deploying.value = false
  }
}
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
        :editable="allowCustomCluster"
        :options="clusterOptionsWithStatus"
        optionLabel="label"
        optionValue="value"
        optionDisabled="disabled"
        class="sr-deploy-select"
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
    <div class="sr-deploy-actions">
      <Button
        label="Deploy"
        icon="pi pi-cloud-upload"
        :loading="deploying"
        :disabled="!clusterName"
        @click="handleDeploy"
      />
    </div>
    <div v-if="deployError" class="sr-deploy-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ deployError }}</span>
    </div>
    <SrClusterStackStatus
      v-if="deployedCluster"
      :cluster="deployedCluster"
      :autoRefresh="true"
      :progressRefreshInterval="5000"
    />
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

.sr-deploy-input {
  width: 15em;
}

.sr-deploy-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.sr-deploy-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-red-500);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
