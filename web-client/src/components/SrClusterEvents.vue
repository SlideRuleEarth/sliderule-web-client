<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { fetchClusterEvents, type StackEvent } from '@/utils/fetchUtils'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrClusterEvents')

const props = withDefaults(
  defineProps<{
    cluster?: string
    autoRefresh?: boolean
    refreshInterval?: number
  }>(),
  {
    cluster: undefined,
    autoRefresh: false,
    refreshInterval: 30000
  }
)

const emit = defineEmits<{
  (_e: 'events-updated', _events: StackEvent[]): void
  (_e: 'error', _message: string): void
}>()

const githubAuthStore = useGitHubAuthStore()
const sysConfigStore = useSysConfigStore()

// Cluster selector state
const selectedCluster = ref<string>('')
const filteredClusters = ref<string[]>([])

// Build list of available cluster suggestions
const clusterSuggestions = computed(() => {
  const suggestions: string[] = []

  if (sysConfigStore.cluster && sysConfigStore.cluster !== 'unknown') {
    suggestions.push(sysConfigStore.cluster)
  }

  if (githubAuthStore.knownClusters?.length > 0) {
    for (const cluster of githubAuthStore.knownClusters) {
      if (!suggestions.includes(cluster)) {
        suggestions.push(cluster)
      }
    }
  }

  return suggestions.sort()
})

const isClusterFixed = computed(() => !!props.cluster)
const effectiveCluster = computed(() => props.cluster ?? selectedCluster.value)

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
const events = ref<StackEvent[]>([])
const autoRefreshEnabled = ref(props.autoRefresh)
let refreshTimer: number | null = null

// Get status class for styling
function getStatusClass(status: string): string {
  if (status.includes('COMPLETE') && !status.includes('DELETE') && !status.includes('ROLLBACK')) {
    return 'sr-status-success'
  }
  if (status.includes('IN_PROGRESS')) return 'sr-status-progress'
  if (status.includes('FAILED') || status.includes('DELETE') || status.includes('ROLLBACK')) {
    return 'sr-status-error'
  }
  return ''
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}

const controlsDisabled = computed(() => {
  return !effectiveCluster.value || effectiveCluster.value.trim() === ''
})

async function refresh() {
  logger.info('refresh() called', {
    effectiveCluster: effectiveCluster.value,
    propsCluster: props.cluster,
    selectedCluster: selectedCluster.value
  })

  if (!effectiveCluster.value || effectiveCluster.value.trim() === '') {
    logger.info('refresh() skipped - no cluster selected')
    return
  }

  loading.value = true
  error.value = null

  try {
    logger.info('Fetching cluster events', { cluster: effectiveCluster.value })
    const result = await fetchClusterEvents(effectiveCluster.value)
    logger.info('fetchClusterEvents result', { result })

    if (result.success && result.data) {
      if (result.data.status === false) {
        // API returned an error (e.g., stack doesn't exist)
        error.value = result.data.exception ?? result.data.error ?? 'Failed to fetch events'
        emit('error', error.value)
        logger.error('Cluster events API error', {
          cluster: effectiveCluster.value,
          exception: result.data.exception
        })
      } else {
        events.value = result.data.events ?? []
        emit('events-updated', events.value)
        logger.info('Cluster events fetched', {
          cluster: effectiveCluster.value,
          count: events.value.length
        })
      }
    } else {
      error.value = result.error ?? 'Failed to fetch events'
      emit('error', error.value)
      logger.error('Failed to fetch cluster events', {
        cluster: effectiveCluster.value,
        error: result.error
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg
    emit('error', msg)
    logger.error('Exception fetching cluster events', {
      cluster: effectiveCluster.value,
      error: msg
    })
  } finally {
    loading.value = false
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (autoRefreshEnabled.value && props.refreshInterval > 0) {
    logger.info('Starting auto-refresh', { interval: props.refreshInterval })
    refreshTimer = window.setInterval(() => {
      void refresh()
    }, props.refreshInterval)
  }
}

function stopAutoRefresh() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function onClusterKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    events.value = []
    void refresh()
  }
}

function onClusterBlur() {
  events.value = []
  void refresh()
}

function onClusterItemSelect() {
  events.value = []
  void refresh()
}

watch(autoRefreshEnabled, (enabled) => {
  if (enabled) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

onMounted(() => {
  logger.info('SrClusterEvents mounted', {
    propsCluster: props.cluster,
    selectedCluster: selectedCluster.value,
    effectiveCluster: effectiveCluster.value,
    autoRefresh: props.autoRefresh
  })
  void refresh()
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

defineExpose({ refresh })
</script>

<template>
  <div class="sr-cluster-events">
    <div class="sr-cluster-events-header">
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
      <div class="sr-cluster-events-controls">
        <div class="sr-auto-refresh-control">
          <Checkbox
            v-model="autoRefreshEnabled"
            inputId="autoRefreshEvents"
            :binary="true"
            :disabled="controlsDisabled"
          />
          <label for="autoRefreshEvents" class="sr-auto-refresh-label">Auto</label>
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

    <div v-if="loading && events.length === 0" class="sr-cluster-events-loading">
      <ProgressSpinner style="width: 2rem; height: 2rem" />
      <span>Loading events...</span>
    </div>

    <div v-else-if="error && events.length === 0" class="sr-cluster-events-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="events.length === 0 && effectiveCluster" class="sr-cluster-events-empty">
      <span>No events found</span>
    </div>

    <DataTable
      v-else-if="events.length > 0"
      :value="events"
      size="small"
      scrollable
      scrollHeight="400px"
      class="sr-events-table"
    >
      <Column field="Timestamp" header="Time" :sortable="true" style="min-width: 150px">
        <template #body="{ data }">
          {{ formatTimestamp(data.Timestamp) }}
        </template>
      </Column>
      <Column
        field="LogicalResourceId"
        header="Resource"
        :sortable="true"
        style="min-width: 150px"
      />
      <Column field="ResourceStatus" header="Status" :sortable="true" style="min-width: 120px">
        <template #body="{ data }">
          <span :class="getStatusClass(data.ResourceStatus)">
            {{ data.ResourceStatus }}
          </span>
        </template>
      </Column>
      <Column field="ResourceStatusReason" header="Reason" style="min-width: 200px">
        <template #body="{ data }">
          {{ data.ResourceStatusReason ?? '-' }}
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.sr-cluster-events {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.sr-cluster-events-header {
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

.sr-cluster-events-controls {
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

.sr-refresh-btn {
  padding: 0.25rem;
}

.sr-cluster-events-loading,
.sr-cluster-events-error,
.sr-cluster-events-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  justify-content: center;
}

.sr-cluster-events-error {
  color: var(--p-red-500);
}

.sr-cluster-events-empty {
  color: var(--p-text-muted-color);
  font-style: italic;
}

.sr-events-table {
  font-size: 0.8rem;
}

.sr-events-table :deep(.p-datatable-header-cell) {
  font-size: 0.8rem;
  padding: 0.5rem;
}

.sr-events-table :deep(.p-datatable-body-cell) {
  padding: 0.4rem 0.5rem;
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
</style>
