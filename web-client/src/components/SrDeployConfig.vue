<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import SrClusterStackStatus from '@/components/SrClusterStackStatus.vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useDeployConfigStore } from '@/stores/deployConfigStore'
import { useStackStatusStore } from '@/stores/stackStatusStore'
import { deployCluster, destroyCluster, extendCluster } from '@/utils/fetchUtils'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDeployConfig')

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()
const stackStatusStore = useStackStatusStore()
const confirm = useConfirm()

// Threshold for large cluster confirmation
const LARGE_CLUSTER_THRESHOLD = 10

// Use storeToRefs for reactive two-way binding
const { domain, clusterName, desiredVersion, numberOfNodes, ttl, isPublic } =
  storeToRefs(deployConfigStore)

// Max values from GitHub auth token
const maxNodes = computed(() => githubAuthStore.maxNodes ?? 10)
const maxTTL = computed(() => githubAuthStore.maxTTL ?? 24)

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
    const statusLabel = stackStatusStore.getStackStatusLabel(c)
    return {
      label: statusLabel ? `${c} (${statusLabel})` : c,
      value: c,
      disabled: stackStatusStore.isClusterUndeployable(c)
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
const domainOptions = ['slideruleearth.io'] //, 'testsliderule.org'] // until support is added by backend

// Only owners can change domain
const isDomainDisabled = computed(() => !githubAuthStore.isOwner)

// Deploy state
const deploying = ref(false)
const deployError = ref<string | null>(null)
const deployErrorDetails = ref<string | null>(null)

// Destroy state
const destroying = ref(false)
const destroyError = ref<string | null>(null)
const destroyErrorDetails = ref<string | null>(null)

async function executeDeploy() {
  deploying.value = true
  deployError.value = null
  deployErrorDetails.value = null

  try {
    const result = await deployCluster({
      cluster: clusterName.value,
      is_public: isPublic.value,
      node_capacity: numberOfNodes.value,
      ttl: ttl.value,
      version: desiredVersion.value || undefined
    })
    if (result.success && result.data?.status) {
      stackStatusStore.enableAutoRefresh(clusterName.value)
    } else {
      deployError.value = result.error ?? 'Deploy failed'
      deployErrorDetails.value = result.errorDetails ?? null
      logger.warn('Deploy failed', { cluster: clusterName.value, error: deployError.value })
    }
  } catch (e) {
    deployError.value = e instanceof Error ? e.message : String(e)
    logger.warn('Deploy exception', { cluster: clusterName.value, error: deployError.value })
  } finally {
    deploying.value = false
  }
}

function handleDeploy() {
  if (!clusterName.value) return

  // Show confirmation for large clusters
  if (numberOfNodes.value > LARGE_CLUSTER_THRESHOLD) {
    confirm.require({
      message: `You are about to deploy a large cluster with ${numberOfNodes.value} nodes. This may incur significant costs. Are you sure you want to proceed?`,
      header: 'Large Cluster Deployment',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      acceptLabel: 'Deploy',
      rejectClass: 'p-button-secondary',
      acceptClass: 'p-button-warning',
      accept: () => {
        void executeDeploy()
      }
    })
  } else {
    void executeDeploy()
  }
}

async function executeDestroy() {
  destroying.value = true
  destroyError.value = null
  destroyErrorDetails.value = null

  try {
    const result = await destroyCluster(clusterName.value)
    if (result.success && result.data?.status) {
      stackStatusStore.enableAutoRefresh(clusterName.value)
    } else {
      destroyError.value = result.error ?? 'Destroy failed'
      destroyErrorDetails.value = result.errorDetails ?? null
    }
  } catch (e) {
    destroyError.value = e instanceof Error ? e.message : String(e)
  } finally {
    destroying.value = false
  }
}

function handleDestroy() {
  if (!clusterName.value) return

  confirm.require({
    message: `Are you sure you want to destroy the cluster "${clusterName.value}"? This action cannot be undone.`,
    header: 'Destroy Cluster',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Destroy',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-danger',
    accept: () => {
      void executeDestroy()
    }
  })
}

// Extend state
const extending = ref(false)
const extendError = ref<string | null>(null)
const extendErrorDetails = ref<string | null>(null)

async function executeExtend() {
  extending.value = true
  extendError.value = null
  extendErrorDetails.value = null

  try {
    const result = await extendCluster(clusterName.value, ttl.value)
    if (result.success && result.data?.status) {
      stackStatusStore.enableAutoRefresh(clusterName.value)
      logger.info('Cluster TTL extended', { cluster: clusterName.value, ttl: ttl.value })
    } else {
      extendError.value = result.error ?? 'Extend failed'
      extendErrorDetails.value = result.errorDetails ?? null
      logger.warn('Extend failed', { cluster: clusterName.value, error: extendError.value })
    }
  } catch (e) {
    extendError.value = e instanceof Error ? e.message : String(e)
    logger.warn('Extend exception', { cluster: clusterName.value, error: extendError.value })
  } finally {
    extending.value = false
  }
}

function handleExtend() {
  if (!clusterName.value) return

  confirm.require({
    message: `Extend the TTL for cluster "${clusterName.value}" to ${ttl.value} minutes?`,
    header: 'Extend Cluster TTL',
    icon: 'pi pi-clock',
    rejectLabel: 'Cancel',
    acceptLabel: 'Extend',
    rejectClass: 'p-button-secondary',
    accept: () => {
      void executeExtend()
    }
  })
}
</script>

<template>
  <ConfirmDialog />
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
      <label for="deploy-cluster" class="sr-deploy-label">cluster</label>
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
    <div class="sr-deploy-field">
      <label for="deploy-public" class="sr-deploy-label">is_public</label>
      <Checkbox id="deploy-public" v-model="isPublic" :binary="true" />
    </div>
    <div class="sr-deploy-field">
      <label for="deploy-nodes" class="sr-deploy-label">node_capacity</label>
      <InputNumber
        id="deploy-nodes"
        v-model="numberOfNodes"
        :min="1"
        :max="maxNodes"
        showButtons
        class="sr-deploy-input-number"
      />
    </div>
    <div class="sr-deploy-field">
      <label for="deploy-ttl" class="sr-deploy-label">ttl (minutes)</label>
      <div class="sr-ttl-group">
        <InputNumber
          id="deploy-ttl"
          v-model="ttl"
          :min="15"
          :max="maxTTL"
          showButtons
          class="sr-deploy-ttl-input"
        />
        <Button
          label="Update"
          icon="pi pi-refresh"
          size="small"
          :loading="extending"
          :disabled="!clusterName || stackStatusStore.isClusterNotUpdatable(clusterName)"
          class="sr-deploy-ttl-btn"
          @click="handleExtend"
        />
      </div>
    </div>
    <div class="sr-deploy-actions">
      <Button
        label="Destroy"
        icon="pi pi-trash"
        severity="danger"
        :loading="destroying"
        :disabled="!clusterName || stackStatusStore.isClusterUndestroyable(clusterName)"
        @click="handleDestroy"
      />
      <Button
        label="Deploy"
        icon="pi pi-cloud-upload"
        :loading="deploying"
        :disabled="!clusterName || stackStatusStore.isClusterUndeployable(clusterName)"
        @click="handleDeploy"
      />
    </div>
    <div v-if="deployError" class="sr-deploy-error">
      <div class="sr-deploy-error-header">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ deployError }}</span>
      </div>
      <div v-if="deployErrorDetails" class="sr-deploy-error-details">{{ deployErrorDetails }}</div>
    </div>
    <div v-if="destroyError" class="sr-deploy-error">
      <div class="sr-deploy-error-header">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ destroyError }}</span>
      </div>
      <div v-if="destroyErrorDetails" class="sr-deploy-error-details">
        {{ destroyErrorDetails }}
      </div>
    </div>
    <div v-if="extendError" class="sr-deploy-error">
      <div class="sr-deploy-error-header">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ extendError }}</span>
      </div>
      <div v-if="extendErrorDetails" class="sr-deploy-error-details">{{ extendErrorDetails }}</div>
    </div>
    <SrClusterStackStatus v-if="clusterName" :cluster="clusterName" />
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

.sr-deploy-input-number {
  width: 15em;
}

.sr-ttl-group {
  display: flex;
  gap: 0.25rem;
  width: 15em;
}

.sr-deploy-ttl-input {
  flex: 1;
  min-width: 0;
}

.sr-deploy-ttl-btn {
  flex-shrink: 0;
}

.sr-deploy-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.sr-deploy-error {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--p-red-500);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.sr-deploy-error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-deploy-error-details {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-left: 1.25rem;
  word-break: break-word;
}
</style>
