<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { fetchProvisionerReport } from '@/utils/fetchUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrReport')

interface ClusterReportEntry {
  cluster: string
  auto_shutdown: string | null
  current_nodes: number
  version: string | null
  is_public: string | null
  node_capacity: string | null
}

const loading = ref(false)
const error = ref<string | null>(null)
const reportData = ref<ClusterReportEntry[]>([])
const lastRefreshTime = ref<Date | null>(null)

const formattedLastRefreshTime = computed(() => {
  if (!lastRefreshTime.value) return null
  return lastRefreshTime.value.toLocaleTimeString()
})

function formatAutoShutdown(val: string | null): string {
  if (!val) return '-'
  try {
    return new Date(val).toLocaleString()
  } catch {
    return val
  }
}

function formatValue(val: string | number | null): string {
  if (val === null || val === undefined) return '-'
  return String(val)
}

function formatPublic(val: string | null): string {
  if (val === 'true' || val === 'True') return 'Yes'
  if (val === 'false' || val === 'False') return 'No'
  return '-'
}

const tableData = computed(() => {
  return reportData.value.map((entry) => ({
    ...entry,
    auto_shutdown_formatted: formatAutoShutdown(entry.auto_shutdown),
    version_formatted: formatValue(entry.version),
    is_public_formatted: formatPublic(entry.is_public),
    node_capacity_formatted: formatValue(entry.node_capacity),
    nodes_display: `${entry.current_nodes} / ${formatValue(entry.node_capacity)}`
  }))
})

async function fetchReport() {
  loading.value = true
  error.value = null

  const result = await fetchProvisionerReport()

  if (result.success && result.data) {
    logger.debug('Report fetched successfully', result.data)
    lastRefreshTime.value = new Date()

    // Transform report object into array for DataTable
    const report = (result.data as { status: boolean; report?: Record<string, unknown> }).report
    if (report && typeof report === 'object') {
      reportData.value = Object.entries(report).map(([cluster, data]) => {
        const entry = data as Record<string, unknown>
        return {
          cluster,
          auto_shutdown: entry.auto_shutdown as string | null,
          current_nodes: (entry.current_nodes as number) ?? 0,
          version: entry.version as string | null,
          is_public: entry.is_public as string | null,
          node_capacity: entry.node_capacity as string | null
        }
      })
    } else {
      reportData.value = []
    }
  } else {
    error.value = result.error ?? 'Unknown error'
    logger.error('Failed to fetch report', { error: result.error })
    reportData.value = []
  }

  loading.value = false
}

onMounted(() => {
  void fetchReport()
})

onActivated(() => {
  void fetchReport()
})

defineExpose({ refresh: fetchReport })
</script>

<template>
  <div class="sr-report">
    <div class="sr-report-header">
      <span class="sr-report-title">Provisioner Report</span>
      <div class="sr-report-controls">
        <span v-if="formattedLastRefreshTime" class="sr-last-refresh-time">
          {{ formattedLastRefreshTime }}
        </span>
        <Button
          icon="pi pi-refresh"
          class="sr-glow-button sr-refresh-btn"
          variant="text"
          rounded
          size="small"
          :loading="loading"
          @click="fetchReport"
        />
      </div>
    </div>

    <div v-if="loading" class="sr-report-loading">
      <ProgressSpinner style="width: 2rem; height: 2rem" />
      <span>Loading report...</span>
    </div>

    <div v-else-if="error" class="sr-report-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="reportData.length === 0" class="sr-report-empty">
      <span>No clusters found in report.</span>
    </div>

    <div v-else class="sr-report-content">
      <DataTable
        :value="tableData"
        size="small"
        stripedRows
        class="sr-report-table"
        scrollable
        scrollHeight="400px"
      >
        <Column field="cluster" header="Cluster" sortable />
        <Column field="version_formatted" header="Version" sortable />
        <Column field="nodes_display" header="Nodes" sortable />
        <Column field="is_public_formatted" header="Public" sortable />
        <Column field="auto_shutdown_formatted" header="Auto Shutdown" sortable />
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.sr-report {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.sr-report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.sr-report-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.sr-report-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-last-refresh-time {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.sr-refresh-btn {
  padding: 0.25rem;
}

.sr-report-loading,
.sr-report-error,
.sr-report-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  justify-content: center;
}

.sr-report-error {
  color: var(--p-red-500);
}

.sr-report-empty {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.sr-report-content {
  padding: 0.5rem 0;
}

.sr-report-table {
  font-size: 0.85rem;
}

.sr-report-table :deep(.p-datatable-header-cell) {
  padding: 0.5rem;
  font-size: 0.8rem;
}

.sr-report-table :deep(.p-datatable-body-cell) {
  padding: 0.4rem 0.5rem;
  font-size: 0.8rem;
}
</style>
