import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Consolidated polling intervals (used by stackStatusStore and clusterEventsStore)
export const DEFAULT_STATUS_REFRESH_INTERVAL = 5000
export const DEFAULT_EVENTS_REFRESH_INTERVAL = 30000

export const useClusterSelectionStore = defineStore('clusterSelection', () => {
  // Selected cluster
  const selectedCluster = ref<string>('')

  // Per-cluster auto-refresh state (single source of truth)
  const autoRefreshClusters = ref<Record<string, boolean>>({})

  // Per-cluster status message (explains why auto-refresh was changed)
  const autoRefreshMessages = ref<Record<string, string | null>>({})

  // Last refresh timestamp
  const lastRefreshTime = ref<Date | null>(null)

  // Computed for current cluster's auto-refresh state
  const autoRefreshEnabled = computed(() => {
    if (!selectedCluster.value) return false
    return autoRefreshClusters.value[selectedCluster.value] ?? false
  })

  // Computed for current cluster's status message
  const autoRefreshMessage = computed(() => {
    if (!selectedCluster.value) return null
    return autoRefreshMessages.value[selectedCluster.value] ?? null
  })

  function setSelectedCluster(cluster: string) {
    selectedCluster.value = cluster
  }

  function clearSelectedCluster() {
    selectedCluster.value = ''
  }

  // Set auto-refresh for current selected cluster (used by UI checkbox)
  // This actually starts/stops polling, not just setting state
  async function setAutoRefreshEnabled(enabled: boolean): Promise<void> {
    if (!selectedCluster.value) return
    if (enabled) {
      // Use enableAutoRefresh to also start polling
      await enableAutoRefresh(selectedCluster.value, '')
      // Clear message since this is manual toggle
      autoRefreshMessages.value[selectedCluster.value] = null
    } else {
      // Use disableAutoRefresh to also stop polling
      await disableAutoRefresh(selectedCluster.value, '')
      // Clear message since this is manual toggle
      autoRefreshMessages.value[selectedCluster.value] = null
    }
  }

  // Get auto-refresh state for any cluster (used by other stores)
  function isAutoRefreshEnabledForCluster(cluster: string): boolean {
    return autoRefreshClusters.value[cluster] ?? false
  }

  /**
   * Enable auto-refresh for a cluster - central coordinator.
   * Sets state and starts polling in both stackStatusStore and clusterEventsStore.
   */
  async function enableAutoRefresh(cluster: string, message: string): Promise<void> {
    autoRefreshClusters.value[cluster] = true
    autoRefreshMessages.value[cluster] = message
    // Lazy import to avoid circular dependencies
    const { useStackStatusStore } = await import('@/stores/stackStatusStore')
    const { useClusterEventsStore } = await import('@/stores/clusterEventsStore')
    useStackStatusStore().startPolling(cluster)
    useClusterEventsStore().startPolling(cluster)
  }

  /**
   * Disable auto-refresh for a cluster - central coordinator.
   * Sets state and stops polling in both stackStatusStore and clusterEventsStore.
   */
  async function disableAutoRefresh(cluster: string, message: string): Promise<void> {
    autoRefreshClusters.value[cluster] = false
    autoRefreshMessages.value[cluster] = message
    // Lazy import to avoid circular dependencies
    const { useStackStatusStore } = await import('@/stores/stackStatusStore')
    const { useClusterEventsStore } = await import('@/stores/clusterEventsStore')
    useStackStatusStore().stopPolling(cluster)
    useClusterEventsStore().stopPolling(cluster)
  }

  // Clear status message for a cluster
  function clearAutoRefreshMessage(cluster?: string) {
    const c = cluster ?? selectedCluster.value
    if (c) autoRefreshMessages.value[c] = null
  }

  function updateLastRefreshTime() {
    lastRefreshTime.value = new Date()
  }

  return {
    selectedCluster,
    autoRefreshEnabled,
    autoRefreshMessage,
    autoRefreshClusters,
    autoRefreshMessages,
    lastRefreshTime,
    setSelectedCluster,
    clearSelectedCluster,
    setAutoRefreshEnabled,
    isAutoRefreshEnabledForCluster,
    enableAutoRefresh,
    disableAutoRefresh,
    clearAutoRefreshMessage,
    updateLastRefreshTime
  }
})
