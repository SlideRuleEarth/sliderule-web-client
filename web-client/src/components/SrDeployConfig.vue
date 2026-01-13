<script setup lang="ts">
import { computed, watch, onMounted, onActivated, ref } from 'vue'
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
import { useClusterSelectionStore } from '@/stores/clusterSelectionStore'
import { useClusterEventsStore } from '@/stores/clusterEventsStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { deployCluster, destroyCluster, extendCluster } from '@/utils/fetchUtils'
import { storeToRefs } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDeployConfig')

const githubAuthStore = useGitHubAuthStore()
const deployConfigStore = useDeployConfigStore()
const stackStatusStore = useStackStatusStore()
const clusterSelectionStore = useClusterSelectionStore()
const clusterEventsStore = useClusterEventsStore()
const sysConfigStore = useSysConfigStore()
const confirm = useConfirm()

// Threshold for large cluster confirmation
const LARGE_CLUSTER_THRESHOLD = 10

// Use storeToRefs for reactive two-way binding
const { domain, clusterName, desiredVersion, numberOfNodes, ttl, isPublic } =
  storeToRefs(deployConfigStore)

// Max values from GitHub auth token
const maxNodes = computed(() => githubAuthStore.maxNodes ?? 10)
const maxTTL = computed(() => githubAuthStore.maxTTL ?? 24 * 60)

// Use deployableClusters directly from the store (exclude "*" wildcard from dropdown)
const clusterList = computed(() =>
  (githubAuthStore.deployableClusters || []).filter((c) => c !== '*')
)

// Check if deployableClusters contains wildcard "*" to enable editable mode
const allowCustomCluster = computed(
  () => githubAuthStore.deployableClusters?.includes('*') ?? false
)

// Deploy state - defined early so watchers can reference them
const deploying = ref(false)
const deployError = ref<string | null>(null)
const deployErrorDetails = ref<string | null>(null)

// Destroy state
const destroying = ref(false)
const destroyError = ref<string | null>(null)
const destroyErrorDetails = ref<string | null>(null)

// Extend state
const extending = ref(false)
const extendError = ref<string | null>(null)
const extendErrorDetails = ref<string | null>(null)

// Cluster name validation hint
const clusterNameHint = ref<string | null>(null)

// Sanitize cluster name to valid subdomain format
function sanitizeClusterName(value: string): string {
  if (!value) return value
  return value
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-z0-9-]/g, '') // Remove invalid characters
    .replace(/^-+/, '') // Remove leading hyphens
    .replace(/-+$/, '') // Remove trailing hyphens
    .slice(0, 63) // Max 63 characters
}

// Watch for custom cluster input and sanitize to valid subdomain
watch(clusterName, (newVal) => {
  if (allowCustomCluster.value && newVal) {
    const sanitized = sanitizeClusterName(newVal)
    if (sanitized !== newVal) {
      clusterName.value = sanitized
      clusterNameHint.value = 'Cluster name adjusted (lowercase, alphanumeric, hyphens only)'
      // Clear hint after 3 seconds
      setTimeout(() => {
        clusterNameHint.value = null
      }, 3000)
    }
  }
})

async function refreshStatus() {
  deployConfigStore.resetStatus()
  if (clusterName.value) {
    // Only fetch version info if cluster is running (avoid CORS errors for non-deployed clusters)
    const status = stackStatusStore.getStackStatus(clusterName.value)
    if (status === 'CREATE_COMPLETE' || status === 'UPDATE_COMPLETE') {
      await deployConfigStore.fetchServerVersionInfo()
    }
  }
}

// Transform cluster options for the dropdown (use centralized list, exclude connected cluster)
const clusterOptions = computed(() => {
  const connectedCluster = sysConfigStore.cluster
  return clusterSelectionStore.allClusters
    .filter((c) => connectedCluster === 'unknown' || c !== connectedCluster)
    .map((c) => ({
      label: c,
      value: c
    }))
})

// Fetch status for all deployable clusters to populate dropdown states
async function fetchAllClusterStatuses() {
  const clusters = clusterList.value
  if (clusters.length > 0) {
    await Promise.all(clusters.map(async (c) => stackStatusStore.fetchStatus(c)))
  }
}

// Set default cluster name when options become available and fetch their statuses
watch(
  clusterList,
  (options) => {
    if (!clusterName.value && options.length > 0) {
      clusterName.value = options[0]
    }
    void fetchAllClusterStatuses()
  },
  { immediate: true }
)

// Refresh status when domain changes
watch(domain, () => {
  void refreshStatus()
})

// Called when user accepts a cluster name (blur, Enter, or dropdown selection)
function onClusterAccepted() {
  if (clusterName.value) {
    void stackStatusStore.fetchStatus(clusterName.value, true)
    clusterEventsStore.invalidate(clusterName.value)
    void refreshStatus()
  }
}

// Sync clusterName to shared selection store (one-way: deploy -> others)
// Clear errors when cluster changes, but DON'T fetch status (wait for user to accept)
watch(
  clusterName,
  (name) => {
    if (name) {
      clusterSelectionStore.setSelectedCluster(name)
    }
    // Clear all errors when cluster selection changes
    deployError.value = null
    deployErrorDetails.value = null
    destroyError.value = null
    destroyErrorDetails.value = null
    extendError.value = null
    extendErrorDetails.value = null
  },
  { immediate: true }
)

// Fetch status on mount and when tab is activated
onMounted(() => {
  void refreshStatus()
})

onActivated(() => {
  void refreshStatus()
})

// Available domain options
const domainOptions = ['slideruleearth.io'] //, 'testsliderule.org'] // until support is added by backend

// Only owners can change domain
const isDomainDisabled = computed(() => !githubAuthStore.isOwner)

async function executeDeploy() {
  deploying.value = true
  void clusterSelectionStore.setAutoRefreshEnabled(true)

  try {
    const result = await deployCluster({
      cluster: clusterName.value,
      is_public: isPublic.value,
      node_capacity: numberOfNodes.value,
      ttl: ttl.value,
      version: desiredVersion.value || undefined
    })
    if (result.success && result.data?.status) {
      // Add custom name to dropdown lists if not already present
      if (!clusterList.value.includes(clusterName.value)) {
        clusterSelectionStore.addCustomName(clusterName.value)
      }
      // Success: enable auto-refresh for both status and events via central coordinator
      void clusterSelectionStore.enableAutoRefresh(clusterName.value, 'Deploying cluster')
      // Force immediate status refresh to get updated state
      void stackStatusStore.fetchStatus(clusterName.value, true)
    } else {
      // Failure: clear pending operation and show error
      stackStatusStore.clearPendingOperation(clusterName.value)
      const exception = result.data?.exception
      deployError.value = exception ?? result.error ?? 'Deploy failed'
      deployErrorDetails.value = result.errorDetails ?? null
      logger.warn('Deploy failed', { cluster: clusterName.value, error: deployError.value })
    }
  } catch (e) {
    // Exception: clear pending operation and show error
    stackStatusStore.clearPendingOperation(clusterName.value)
    deployError.value = e instanceof Error ? e.message : String(e)
    logger.warn('Deploy exception', { cluster: clusterName.value, error: deployError.value })
  } finally {
    deploying.value = false
  }
}

function handleDeploy() {
  if (!clusterName.value) return
  if (stackStatusStore.hasPendingOperation(clusterName.value)) return
  if (stackStatusStore.isClusterUndeployable(clusterName.value)) return

  // Clear any previous error immediately
  deployError.value = null
  deployErrorDetails.value = null

  // Set pending operation (persists until status confirms)
  stackStatusStore.setPendingOperation(clusterName.value, 'deploy')
  deploying.value = true

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
      },
      reject: () => {
        deploying.value = false
        stackStatusStore.clearPendingOperation(clusterName.value)
      }
    })
  } else {
    void executeDeploy()
  }
}

async function executeDestroy() {
  destroying.value = true
  void clusterSelectionStore.setAutoRefreshEnabled(true)

  try {
    const result = await destroyCluster(clusterName.value)
    if (result.success && result.data?.status) {
      // Success: enable auto-refresh for both status and events via central coordinator
      void clusterSelectionStore.enableAutoRefresh(clusterName.value, 'Stopping cluster')
      // Force immediate status refresh to get updated state
      void stackStatusStore.fetchStatus(clusterName.value, true)
    } else {
      // Failure: clear pending operation and show error
      stackStatusStore.clearPendingOperation(clusterName.value)
      const exception = result.data?.exception
      destroyError.value = exception ?? result.error ?? 'Destroy failed'
      destroyErrorDetails.value = result.errorDetails ?? null
    }
  } catch (e) {
    // Exception: clear pending operation and show error
    stackStatusStore.clearPendingOperation(clusterName.value)
    destroyError.value = e instanceof Error ? e.message : String(e)
  } finally {
    destroying.value = false
  }
}

function handleDestroy() {
  if (!clusterName.value) return
  if (stackStatusStore.hasPendingOperation(clusterName.value)) return
  if (stackStatusStore.isClusterUndestroyable(clusterName.value)) return

  // Clear any previous error immediately
  destroyError.value = null
  destroyErrorDetails.value = null

  // Set pending operation (persists until status confirms)
  stackStatusStore.setPendingOperation(clusterName.value, 'destroy')
  destroying.value = true

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
    },
    reject: () => {
      destroying.value = false
      stackStatusStore.clearPendingOperation(clusterName.value)
    }
  })
}

async function executeExtend() {
  extending.value = true
  void clusterSelectionStore.setAutoRefreshEnabled(true)

  try {
    const result = await extendCluster(clusterName.value, ttl.value)
    if (result.success && result.data?.status) {
      // Success: enable auto-refresh for both status and events via central coordinator
      void clusterSelectionStore.enableAutoRefresh(clusterName.value, 'Extending cluster TTL')
      // Force immediate status refresh to get updated state
      void stackStatusStore.fetchStatus(clusterName.value, true)
      logger.info('Cluster TTL extended', { cluster: clusterName.value, ttl: ttl.value })
    } else {
      // Failure: clear pending operation and show error
      stackStatusStore.clearPendingOperation(clusterName.value)
      const exception = result.data?.exception
      extendError.value = exception ?? result.error ?? 'Extend failed'
      extendErrorDetails.value = result.errorDetails ?? null
      logger.warn('Extend failed', { cluster: clusterName.value, error: extendError.value })
    }
  } catch (e) {
    // Exception: clear pending operation and show error
    stackStatusStore.clearPendingOperation(clusterName.value)
    extendError.value = e instanceof Error ? e.message : String(e)
    logger.warn('Extend exception', { cluster: clusterName.value, error: extendError.value })
  } finally {
    extending.value = false
  }
}

function handleExtend() {
  if (!clusterName.value) return
  if (stackStatusStore.hasPendingOperation(clusterName.value)) return
  if (stackStatusStore.isClusterNotUpdatable(clusterName.value)) return

  // Clear any previous error immediately
  extendError.value = null
  extendErrorDetails.value = null

  // Set pending operation (persists until status confirms)
  stackStatusStore.setPendingOperation(clusterName.value, 'extend')
  extending.value = true

  confirm.require({
    message: `Extend the TTL for cluster "${clusterName.value}" to ${ttl.value} minutes?`,
    header: 'Extend Cluster TTL',
    icon: 'pi pi-clock',
    rejectLabel: 'Cancel',
    acceptLabel: 'Extend',
    rejectClass: 'p-button-secondary',
    accept: () => {
      void executeExtend()
    },
    reject: () => {
      extending.value = false
      stackStatusStore.clearPendingOperation(clusterName.value)
    }
  })
}

/**
 * Refresh function for tab activation - refreshes both deploy config and stack status
 */
async function refresh() {
  await refreshStatus()
  if (clusterName.value) {
    await stackStatusStore.fetchStatus(clusterName.value, true)
  }
}

defineExpose({ refresh })
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
      <div class="sr-cluster-input-wrapper">
        <Select
          id="deploy-cluster"
          v-model="clusterName"
          :editable="allowCustomCluster"
          :options="clusterOptions"
          optionLabel="label"
          optionValue="value"
          class="sr-deploy-select"
          @change="onClusterAccepted"
          @blur="onClusterAccepted"
        />
        <small v-if="clusterNameHint" class="sr-cluster-hint">{{ clusterNameHint }}</small>
      </div>
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
          :disabled="
            !clusterName ||
            stackStatusStore.hasPendingOperation(clusterName) ||
            stackStatusStore.isClusterNotUpdatable(clusterName)
          "
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
        :disabled="
          !clusterName ||
          stackStatusStore.hasPendingOperation(clusterName) ||
          stackStatusStore.isClusterUndestroyable(clusterName)
        "
        @click="handleDestroy"
      />
      <Button
        label="Deploy"
        icon="pi pi-cloud-upload"
        :loading="deploying"
        :disabled="
          !clusterName ||
          stackStatusStore.hasPendingOperation(clusterName) ||
          stackStatusStore.isClusterUndeployable(clusterName)
        "
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

.sr-cluster-input-wrapper {
  display: flex;
  flex-direction: column;
}

.sr-cluster-hint {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  margin-top: 0.25rem;
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
