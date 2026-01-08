<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Sidebar from 'primevue/sidebar'
import { fetchClusterEvents, type StackEvent } from '@/utils/fetchUtils'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import SrJsonDisplayDialog from '@/components/SrJsonDisplayDialog.vue'
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

// Authorization checks
const canAccessMemberFeatures = computed(() => githubAuthStore.canAccessMemberFeatures)
const isOwner = computed(() => githubAuthStore.isOrgOwner)

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

// Row expansion state
const expandedRows = ref<Record<string, boolean>>({})

// Dialog state (owner-only features)
const showEventDetailDialog = ref(false)
const selectedEventData = ref<StackEvent | null>(null)
const selectedEventTitle = ref('')
const showPropertiesDialog = ref(false)
const selectedProperties = ref<object | null>(null)
const selectedPropertiesTitle = ref('')

// Drawer state
const drawerVisible = ref(false)

function openDrawer() {
  drawerVisible.value = true
}

// Summary computed properties
const eventCount = computed(() => events.value.length)

const lastEventTime = computed(() => {
  if (events.value.length === 0) return null
  const sorted = [...events.value].sort(
    (a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
  )
  return sorted[0]?.Timestamp
})

const statusCounts = computed(() => {
  const counts = { inProgress: 0, failed: 0, complete: 0 }
  for (const event of events.value) {
    const status = event.ResourceStatus
    if (status.includes('IN_PROGRESS')) {
      counts.inProgress++
    } else if (status.includes('FAILED') || status.includes('ROLLBACK')) {
      counts.failed++
    } else if (status.includes('COMPLETE') && !status.includes('DELETE')) {
      counts.complete++
    }
  }
  return counts
})

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

// Format resource type (strip AWS:: prefix for brevity)
function formatResourceType(resourceType: string | undefined): string {
  if (!resourceType) return '-'
  return resourceType.replace('AWS::', '')
}

// Parse ResourceProperties JSON string
function parseResourceProperties(props: string | undefined): object | null {
  if (!props) return null
  try {
    return JSON.parse(props)
  } catch {
    return null
  }
}

// Open event detail dialog (owner-only)
function openEventDetailDialog(event: StackEvent) {
  selectedEventData.value = event
  selectedEventTitle.value = `Event: ${event.LogicalResourceId}`
  showEventDetailDialog.value = true
}

// Open properties dialog (owner-only)
function openPropertiesDialog(event: StackEvent) {
  if (!event.ResourceProperties) return
  selectedProperties.value = parseResourceProperties(event.ResourceProperties)
  selectedPropertiesTitle.value = `Properties: ${event.LogicalResourceId}`
  showPropertiesDialog.value = true
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
        events.value = result.data.response ?? []
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
  <div v-if="canAccessMemberFeatures" class="sr-cluster-events">
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

    <!-- Compact Summary View -->
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

    <div v-else-if="events.length > 0" class="sr-events-summary">
      <div class="sr-events-summary-stats">
        <div class="sr-events-stat">
          <span class="sr-events-stat-value">{{ eventCount }}</span>
          <span class="sr-events-stat-label">Events</span>
        </div>
        <div v-if="statusCounts.inProgress > 0" class="sr-events-stat sr-stat-progress">
          <span class="sr-events-stat-value">{{ statusCounts.inProgress }}</span>
          <span class="sr-events-stat-label">In Progress</span>
        </div>
        <div v-if="statusCounts.complete > 0" class="sr-events-stat sr-stat-success">
          <span class="sr-events-stat-value">{{ statusCounts.complete }}</span>
          <span class="sr-events-stat-label">Complete</span>
        </div>
        <div v-if="statusCounts.failed > 0" class="sr-events-stat sr-stat-error">
          <span class="sr-events-stat-value">{{ statusCounts.failed }}</span>
          <span class="sr-events-stat-label">Failed</span>
        </div>
      </div>
      <div v-if="lastEventTime" class="sr-events-last-update">
        Last event: {{ formatTimestamp(lastEventTime) }}
      </div>
      <Button
        label="View Events"
        icon="pi pi-external-link"
        size="small"
        class="sr-view-events-btn"
        @click="openDrawer"
      />
    </div>

    <!-- Slide-out Drawer with Full Events Table -->
    <Sidebar v-model:visible="drawerVisible" position="left" class="sr-events-drawer">
      <template #header>
        <div class="sr-drawer-header">
          <span class="sr-drawer-title">Stack Events: {{ effectiveCluster }}</span>
        </div>
      </template>

      <div class="sr-drawer-controls">
        <div class="sr-auto-refresh-control">
          <Checkbox v-model="autoRefreshEnabled" inputId="autoRefreshEventsDrawer" :binary="true" />
          <label for="autoRefreshEventsDrawer" class="sr-auto-refresh-label">Auto-refresh</label>
        </div>
        <Button
          icon="pi pi-refresh"
          class="sr-glow-button"
          variant="text"
          rounded
          size="small"
          :loading="loading"
          @click="refresh"
        />
      </div>

      <DataTable
        v-model:expandedRows="expandedRows"
        :value="events"
        dataKey="EventId"
        size="small"
        scrollable
        scrollHeight="calc(100vh - 200px)"
        class="sr-events-table"
      >
        <Column :expander="true" style="width: 3rem" />
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
        <Column field="ResourceType" header="Type" :sortable="true" style="min-width: 150px">
          <template #body="{ data }">
            {{ formatResourceType(data.ResourceType) }}
          </template>
        </Column>
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

        <template #expansion="slotProps">
          <div class="sr-event-expansion">
            <div class="sr-event-detail-row">
              <span class="sr-event-detail-label">Physical Resource ID:</span>
              <span class="sr-event-detail-value">{{
                slotProps.data.PhysicalResourceId || '-'
              }}</span>
            </div>
            <div class="sr-event-detail-row">
              <span class="sr-event-detail-label">Resource Type:</span>
              <span class="sr-event-detail-value">{{ slotProps.data.ResourceType || '-' }}</span>
            </div>
            <div v-if="isOwner" class="sr-event-detail-actions">
              <Button
                v-if="slotProps.data.ResourceProperties"
                label="View Properties"
                icon="pi pi-code"
                size="small"
                severity="secondary"
                @click="openPropertiesDialog(slotProps.data)"
              />
              <Button
                label="View Full Event"
                icon="pi pi-info-circle"
                size="small"
                @click="openEventDetailDialog(slotProps.data)"
              />
            </div>
          </div>
        </template>
      </DataTable>
    </Sidebar>

    <!-- Event Detail Dialog (owner-only) -->
    <SrJsonDisplayDialog
      v-model="showEventDetailDialog"
      :jsonData="selectedEventData"
      :title="selectedEventTitle"
      width="60vw"
    />

    <!-- Resource Properties Dialog (owner-only) -->
    <SrJsonDisplayDialog
      v-model="showPropertiesDialog"
      :jsonData="selectedProperties"
      :title="selectedPropertiesTitle"
      width="50vw"
    />
  </div>

  <!-- Unauthorized message -->
  <div v-else class="sr-cluster-events-unauthorized">
    <i class="pi pi-lock"></i>
    <span>Access restricted to organization members</span>
  </div>
</template>

<style scoped>
.sr-cluster-events {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
  width: 100%;
  min-width: 0;
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
  width: 100%;
}

.sr-events-table :deep(.p-datatable-table-container) {
  overflow-x: auto;
}

.sr-events-table :deep(.p-datatable-header-cell) {
  font-size: 0.8rem;
  padding: 0.5rem;
  white-space: nowrap;
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

.sr-cluster-events-unauthorized {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.sr-event-expansion {
  padding: 1rem;
  margin: 0.5rem;
  border-left: 3px solid var(--p-primary-color);
  padding-left: 1rem;
}

.sr-event-detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.sr-event-detail-label {
  font-weight: 600;
  color: var(--p-text-muted-color);
  min-width: 140px;
}

.sr-event-detail-value {
  word-break: break-all;
  color: var(--p-text-color);
}

.sr-event-detail-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--p-content-border-color);
}

/* Summary View Styles */
.sr-events-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
}

.sr-events-summary-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.sr-events-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
}

.sr-events-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.sr-events-stat-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
}

.sr-stat-progress .sr-events-stat-value {
  color: var(--p-yellow-500);
}

.sr-stat-success .sr-events-stat-value {
  color: var(--p-green-500);
}

.sr-stat-error .sr-events-stat-value {
  color: var(--p-red-500);
}

.sr-events-last-update {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.sr-view-events-btn {
  margin-top: 0.5rem;
}

/* Drawer Styles - Note: actual Sidebar width is in non-scoped style block below */

.sr-drawer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-drawer-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.sr-drawer-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.5rem 0 1rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 1rem;
}
</style>

<!-- Non-scoped styles for PrimeVue Sidebar (renders outside component via portal) -->
<style>
.sr-events-drawer.p-drawer {
  width: 90vw !important;
  min-width: 900px;
}
</style>
