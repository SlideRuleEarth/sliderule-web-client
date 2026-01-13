import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useClusterSelectionStore = defineStore('clusterSelection', () => {
  // Selected cluster
  const selectedCluster = ref<string>('')

  // Per-cluster auto-refresh state (single source of truth)
  const autoRefreshClusters = ref<Record<string, boolean>>({})

  // Last refresh timestamp
  const lastRefreshTime = ref<Date | null>(null)

  // Computed for current cluster's auto-refresh state
  const autoRefreshEnabled = computed(() => {
    if (!selectedCluster.value) return false
    return autoRefreshClusters.value[selectedCluster.value] ?? false
  })

  function setSelectedCluster(cluster: string) {
    selectedCluster.value = cluster
  }

  function clearSelectedCluster() {
    selectedCluster.value = ''
  }

  // Set auto-refresh for current selected cluster
  function setAutoRefreshEnabled(enabled: boolean) {
    if (!selectedCluster.value) return
    autoRefreshClusters.value[selectedCluster.value] = enabled
  }

  // Get auto-refresh state for any cluster (used by other stores)
  function isAutoRefreshEnabledForCluster(cluster: string): boolean {
    return autoRefreshClusters.value[cluster] ?? false
  }

  // Set auto-refresh state for any cluster (used by other stores)
  function setAutoRefreshForCluster(cluster: string, enabled: boolean) {
    autoRefreshClusters.value[cluster] = enabled
  }

  function updateLastRefreshTime() {
    lastRefreshTime.value = new Date()
  }

  return {
    selectedCluster,
    autoRefreshEnabled,
    autoRefreshClusters,
    lastRefreshTime,
    setSelectedCluster,
    clearSelectedCluster,
    setAutoRefreshEnabled,
    isAutoRefreshEnabledForCluster,
    setAutoRefreshForCluster,
    updateLastRefreshTime
  }
})
