<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import AutoComplete from 'primevue/autocomplete'
import Panel from 'primevue/panel'
import { type ClusterStatusResponse } from '@/utils/fetchUtils'
import { useStackStatusStore } from '@/stores/stackStatusStore'
import { useClusterSelectionStore } from '@/stores/clusterSelectionStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrClusterStackStatus')

const props = defineProps<{
  cluster?: string
}>()

// Human-readable status descriptions
const STATUS_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  CREATE_IN_PROGRESS: { label: 'Creating', description: 'Cluster is being created...' },
  CREATE_COMPLETE: { label: 'Running', description: 'Cluster is up and running' },
  CREATE_FAILED: { label: 'Create Failed', description: 'Cluster creation failed' },
  UPDATE_IN_PROGRESS: { label: 'Updating', description: 'Cluster is being updated...' },
  UPDATE_COMPLETE: { label: 'Running', description: 'Cluster is up and running' },
  UPDATE_COMPLETE_CLEANUP_IN_PROGRESS: {
    label: 'Updating',
    description: 'Cleaning up after update...'
  },
  UPDATE_FAILED: { label: 'Update Failed', description: 'Cluster update failed' },
  UPDATE_ROLLBACK_IN_PROGRESS: {
    label: 'Rolling Back',
    description: 'Update failed, rolling back...'
  },
  UPDATE_ROLLBACK_COMPLETE: {
    label: 'Rolled Back',
    description: 'Update rolled back successfully'
  },
  UPDATE_ROLLBACK_FAILED: { label: 'Rollback Failed', description: 'Update rollback failed' },
  DELETE_IN_PROGRESS: { label: 'Deleting', description: 'Cluster is being deleted...' },
  DELETE_COMPLETE: { label: 'Deleted', description: 'Cluster has been deleted' },
  DELETE_FAILED: { label: 'Delete Failed', description: 'Cluster deletion failed' },
  ROLLBACK_IN_PROGRESS: { label: 'Rolling Back', description: 'Cluster is rolling back...' },
  ROLLBACK_COMPLETE: { label: 'Rolled Back', description: 'Cluster rolled back' },
  ROLLBACK_FAILED: { label: 'Rollback Failed', description: 'Cluster rollback failed' }
}

const emit = defineEmits<{
  (_e: 'status-updated', _data: ClusterStatusResponse | null): void
  (_e: 'error', _message: string): void
}>()

const stackStatusStore = useStackStatusStore()
const clusterSelectionStore = useClusterSelectionStore()

// Cluster selector state - use shared store
const selectedCluster = computed({
  get: () => clusterSelectionStore.selectedCluster,
  set: (value: string) => clusterSelectionStore.setSelectedCluster(value)
})
const filteredClusters = ref<string[]>([])

// Use centralized cluster list from store (includes known, deployable, and custom clusters)
const clusterSuggestions = computed(() => clusterSelectionStore.allClusters)

// Fixed cluster mode - when cluster prop is provided
const isClusterFixed = computed(() => !!props.cluster)

const effectiveCluster = computed(() => props.cluster ?? selectedCluster.value)

// Filter clusters for autocomplete
function searchClusters(event: { query: string }) {
  const query = event.query.toLowerCase()
  if (!query) {
    filteredClusters.value = [...clusterSuggestions.value]
  } else {
    filteredClusters.value = clusterSuggestions.value.filter((c) => c.toLowerCase().includes(query))
  }
}

const loading = ref(false)
const error = ref<string | null>(null)
const statusData = ref<ClusterStatusResponse | null>(null)

// Auto-refresh - use effectiveCluster directly (not selectedCluster) to avoid cross-cluster interference
const autoRefreshEnabled = computed({
  get: () => {
    if (!effectiveCluster.value) return false
    return clusterSelectionStore.isAutoRefreshEnabledForCluster(effectiveCluster.value)
  },
  set: async (value: boolean) => {
    if (!effectiveCluster.value) return
    if (value) {
      await clusterSelectionStore.enableAutoRefresh(effectiveCluster.value, '')
    } else {
      await clusterSelectionStore.disableAutoRefresh(effectiveCluster.value, '')
    }
  }
})

// Auto-refresh message - use effectiveCluster directly
const autoRefreshMessage = computed(() => {
  if (!effectiveCluster.value) return null
  return clusterSelectionStore.autoRefreshMessages[effectiveCluster.value] ?? null
})

// Format last refresh time for display - per-cluster
const formattedLastRefreshTime = computed(() => {
  if (!effectiveCluster.value) return null
  const time = clusterSelectionStore.getLastRefreshTime(effectiveCluster.value)
  if (!time) return null
  return time.toLocaleTimeString()
})

// Helper functions for extracting status info from data
function getStackStatus(data: ClusterStatusResponse | null): string {
  return data?.response?.StackStatus ?? 'Unknown'
}

function getStatusInfo(data: ClusterStatusResponse | null) {
  const status = getStackStatus(data)
  return STATUS_DESCRIPTIONS[status] ?? { label: status, description: '' }
}

function getStackStatusClass(data: ClusterStatusResponse | null): string {
  const status = getStackStatus(data)
  if (status.includes('COMPLETE') && !status.includes('DELETE')) return 'sr-status-success'
  if (status.includes('IN_PROGRESS')) return 'sr-status-progress'
  if (status.includes('FAILED') || status.includes('DELETE')) return 'sr-status-error'
  return 'sr-status-unknown'
}

function clusterExists(data: ClusterStatusResponse | null): boolean {
  logger.debug('Checking if cluster exists', { data })
  if (!data) return false
  // Cluster exists if StackStatus is not NOT_FOUND (uses normalized response from store)
  return data.response?.StackStatus !== 'NOT_FOUND'
}

/**
 * Check if we have a definitive NOT_FOUND status (not just unknown/error).
 * Use this to avoid treating fetch errors as "cluster doesn't exist".
 */
function isDefinitelyNotFound(data: ClusterStatusResponse | null): boolean {
  if (!data) return false // null means unknown, not "doesn't exist"
  return data.response?.StackStatus === 'NOT_FOUND'
}

function isClusterInProgress(data: ClusterStatusResponse | null): boolean {
  return getStackStatus(data).includes('IN_PROGRESS')
}

function getCurrentNodes(data: ClusterStatusResponse | null): string | number {
  return data?.current_nodes ?? '-'
}

function getNodeCapacity(data: ClusterStatusResponse | null): string {
  return data?.node_capacity ?? '-'
}

function getVersion(data: ClusterStatusResponse | null): string {
  return data?.version ?? 'Unknown'
}

function getIsPublic(data: ClusterStatusResponse | null): string {
  const val = data?.is_public
  if (val === 'True' || val === 'true') return 'Yes'
  if (val === 'False' || val === 'false') return 'No'
  return 'Unknown'
}

function getAutoShutdown(data: ClusterStatusResponse | null): string {
  const val = data?.auto_shutdown
  if (!val) return 'Not set'
  try {
    return new Date(val).toLocaleString()
  } catch {
    return val
  }
}

function getCreationTime(data: ClusterStatusResponse | null): string {
  const val = data?.response?.CreationTime
  if (!val) return 'Unknown'
  try {
    return new Date(val).toLocaleString()
  } catch {
    return val
  }
}

function getResponseDetails(data: ClusterStatusResponse | null): string {
  if (!data?.response) return '{}'
  try {
    return JSON.stringify(data.response, null, 2)
  } catch {
    return '{}'
  }
}

// Check if cluster is in progress (for adaptive polling)
const isInProgress = computed(() => {
  return isClusterInProgress(statusData.value)
})

// Disable controls when no cluster is selected
const controlsDisabled = computed(() => {
  return !effectiveCluster.value || effectiveCluster.value.trim() === ''
})

async function refresh() {
  // Skip if no cluster is selected
  if (!effectiveCluster.value || effectiveCluster.value.trim() === '') {
    return
  }

  // Clear status message on manual refresh
  clusterSelectionStore.clearAutoRefreshMessage(effectiveCluster.value)

  loading.value = true
  error.value = null

  // Use store to fetch status (force refresh)
  const data = await stackStatusStore.fetchStatus(effectiveCluster.value, true)

  // Get error from store if fetch failed
  const storeError = stackStatusStore.getError(effectiveCluster.value)

  if (data) {
    statusData.value = data
    clusterSelectionStore.updateLastRefreshTime(effectiveCluster.value)
    emit('status-updated', data)
    logger.debug('Cluster status fetched', { cluster: effectiveCluster.value, data })
  } else if (storeError) {
    error.value = storeError
    emit('error', storeError)
    logger.error('Failed to fetch cluster status', {
      cluster: effectiveCluster.value,
      error: storeError
    })
  }

  loading.value = false
}

// Handle Enter key or blur to trigger refresh
function onClusterKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    statusData.value = null
    void refresh()
  }
}

function onClusterBlur() {
  statusData.value = null
  void refresh()
}

function onClusterItemSelect() {
  statusData.value = null
  void refresh()
}

// Clear status and refresh when cluster changes
watch(effectiveCluster, (newCluster, oldCluster) => {
  if (newCluster !== oldCluster) {
    // Clear stale status data from previous cluster
    statusData.value = null
    error.value = null
    if (newCluster) {
      void refresh()
    }
  }
})

// Sync statusData from store cache when background polling updates it
watch(
  () => effectiveCluster.value && stackStatusStore.statusCache[effectiveCluster.value],
  (cachedData) => {
    if (cachedData && effectiveCluster.value) {
      statusData.value = cachedData
    }
  }
)

// Disable auto-refresh when cluster transitions to stable running state
watch(isInProgress, async (inProgress, wasInProgress) => {
  if (wasInProgress && !inProgress && clusterExists(statusData.value)) {
    const status = getStackStatus(statusData.value)
    if (status === 'CREATE_COMPLETE' || status === 'UPDATE_COMPLETE') {
      logger.info('Cluster is now running, disabling auto-refresh', {
        cluster: effectiveCluster.value,
        status
      })
      // Do final refresh FIRST, then disable auto-refresh
      // This ensures UI shows the stable state before we stop polling
      await refresh()
      autoRefreshEnabled.value = false
    }
  }
})

// Disable auto-refresh when cluster is definitively NOT_FOUND (e.g., after Destroy)
// Uses isDefinitelyNotFound to avoid treating fetch errors as "cluster doesn't exist"
watch(
  () => isDefinitelyNotFound(statusData.value),
  async (notFound, wasNotFound) => {
    // Don't disable if we have a pending deploy - the cluster doesn't exist YET
    const pendingOp = effectiveCluster.value
      ? stackStatusStore.getPendingOperation(effectiveCluster.value)
      : null
    if (pendingOp === 'deploy') {
      return
    }

    if (wasNotFound === false && notFound === true && autoRefreshEnabled.value) {
      logger.info('Cluster no longer exists, disabling auto-refresh', {
        cluster: effectiveCluster.value
      })
      // Do final refresh FIRST, then disable auto-refresh
      // This ensures UI shows the deleted state before we stop polling
      await refresh()
      autoRefreshEnabled.value = false
    }
  }
)

onMounted(async () => {
  await refresh()
  // Only disable auto-refresh if cluster is in a stable state
  // If in transition (CREATE_IN_PROGRESS, DELETE_IN_PROGRESS, etc.), preserve the
  // auto-refresh setting so user can watch the operation complete after tab switches
  if (!isInProgress.value) {
    autoRefreshEnabled.value = false
  }
})

onActivated(() => {
  void refresh()
})

// Note: We don't stop polling on unmount - the store manages background polling
// and it should continue even when this component is not displayed

defineExpose({ refresh })
</script>

<template>
  <div class="sr-server-status">
    <div class="sr-server-status-header">
      <div class="sr-cluster-selector-container">
        <label class="sr-cluster-label">Cluster</label>
        <span v-if="isClusterFixed" class="sr-cluster-fixed">
          {{ cluster }}
        </span>
        <AutoComplete
          v-else
          v-model="selectedCluster"
          :suggestions="filteredClusters"
          :dropdown="true"
          :forceSelection="false"
          placeholder="Enter cluster name"
          class="sr-cluster-autocomplete"
          @complete="searchClusters"
          @keydown="onClusterKeydown"
          @blur="onClusterBlur"
          @item-select="onClusterItemSelect"
        />
      </div>
      <div class="sr-server-status-controls">
        <span v-if="autoRefreshMessage" class="sr-auto-refresh-message">
          {{ autoRefreshMessage }}
        </span>
        <span v-if="formattedLastRefreshTime" class="sr-last-refresh-time">
          {{ formattedLastRefreshTime }}
        </span>
        <div class="sr-auto-refresh-control">
          <Checkbox
            v-model="autoRefreshEnabled"
            inputId="autoRefresh"
            :binary="true"
            :disabled="controlsDisabled"
          />
          <label for="autoRefresh" class="sr-auto-refresh-label">Auto</label>
        </div>
        <Button
          icon="pi pi-refresh"
          class="sr-glow-button sr-refresh-btn"
          variant="text"
          rounded
          size="small"
          :loading="loading"
          :disabled="controlsDisabled"
          @click="refresh"
        />
      </div>
    </div>

    <div v-if="loading && !statusData" class="sr-server-status-loading">
      <ProgressSpinner style="width: 2rem; height: 2rem" />
      <span>Loading status...</span>
    </div>

    <div v-else-if="error && !statusData" class="sr-server-status-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ error }}</span>
    </div>

    <!-- Single cluster display (for all clusters including public) -->
    <template v-else>
      <div class="sr-server-status-field">
        <label class="sr-server-status-label">Exists</label>
        <span
          :class="[
            'sr-server-status-value',
            statusData === null
              ? ''
              : clusterExists(statusData)
                ? 'sr-status-success'
                : 'sr-status-error'
          ]"
        >
          {{ statusData === null ? '-' : clusterExists(statusData) ? 'Yes' : 'No' }}
        </span>
      </div>

      <template v-if="clusterExists(statusData)">
        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Cluster Status</label>
          <div class="sr-server-status-value-wrapper">
            <ProgressSpinner
              v-if="isClusterInProgress(statusData)"
              style="width: 1rem; height: 1rem"
              strokeWidth="4"
            />
            <span :class="['sr-server-status-value', getStackStatusClass(statusData)]">
              {{ getStatusInfo(statusData).label }}
            </span>
          </div>
        </div>

        <div v-if="getStatusInfo(statusData).description" class="sr-server-status-description">
          {{ getStatusInfo(statusData).description }}
        </div>

        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Version</label>
          <span class="sr-server-status-value">{{ getVersion(statusData) }}</span>
        </div>

        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Nodes</label>
          <span class="sr-server-status-value"
            >{{ getCurrentNodes(statusData) }} / {{ getNodeCapacity(statusData) }}</span
          >
        </div>

        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Public</label>
          <span class="sr-server-status-value">{{ getIsPublic(statusData) }}</span>
        </div>

        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Auto Shutdown</label>
          <span class="sr-server-status-value">{{ getAutoShutdown(statusData) }}</span>
        </div>

        <div class="sr-server-status-field">
          <label class="sr-server-status-label">Created</label>
          <span class="sr-server-status-value">{{ getCreationTime(statusData) }}</span>
        </div>

        <Panel header="Details" toggleable collapsed class="sr-details-panel">
          <pre class="sr-json-details">{{ getResponseDetails(statusData) }}</pre>
        </Panel>
      </template>
    </template>
  </div>
</template>

<style scoped>
.sr-server-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.sr-server-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.sr-cluster-selector-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-cluster-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.sr-cluster-autocomplete {
  width: 100%;
  max-width: 200px;
}

.sr-cluster-autocomplete :deep(.p-autocomplete-input) {
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.sr-cluster-fixed {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.sr-server-status-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-primary-color);
}

.sr-server-status-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-auto-refresh-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sr-auto-refresh-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
}

.sr-auto-refresh-message {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  font-style: italic;
  margin-left: 0.25rem;
}

.sr-refresh-btn {
  padding: 0.25rem;
}

.sr-last-refresh-time {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.sr-server-status-loading,
.sr-server-status-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  justify-content: center;
}

.sr-server-status-error {
  color: var(--p-red-500);
}

.sr-server-status-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
}

.sr-server-status-label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  margin-right: 0.5rem;
}

.sr-server-status-value {
  font-size: 0.85rem;
  text-align: right;
  word-break: break-word;
}

.sr-server-status-value-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
}

.sr-server-status-description {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
  padding: 0.25rem 0;
  font-style: italic;
}

.sr-status-success {
  color: var(--p-green-500);
}

.sr-status-progress {
  color: var(--p-yellow-500);
}

.sr-status-error {
  color: var(--p-red-500);
}

.sr-status-unknown {
  color: var(--p-text-muted-color);
}

.sr-details-panel {
  margin-top: 0.5rem;
}

.sr-details-panel :deep(.p-panel-header) {
  padding: 0.5rem;
  font-size: 0.85rem;
}

.sr-details-panel :deep(.p-panel-content) {
  padding: 0.5rem;
}

.sr-json-details {
  margin: 0;
  padding: 0.5rem;
  background-color: var(--p-surface-900);
  color: var(--p-text-color);
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
