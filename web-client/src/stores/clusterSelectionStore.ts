import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSysConfigStore } from '@/stores/sysConfigStore'

// Consolidated polling intervals (used by stackStatusStore and clusterEventsStore)
export const DEFAULT_STATUS_REFRESH_INTERVAL = 5000
export const DEFAULT_EVENTS_REFRESH_INTERVAL = 30000

export const useClusterSelectionStore = defineStore('clusterSelection', () => {
  // Selected cluster
  const selectedCluster = ref<string>('')

  // Custom names entered by users (used for both cluster and subdomain lists)
  const customNames = ref<string[]>([])

  // Per-cluster auto-refresh state (single source of truth)
  const autoRefreshClusters = ref<Record<string, boolean>>({})

  // Per-cluster status message (explains why auto-refresh was changed)
  const autoRefreshMessages = ref<Record<string, string | null>>({})

  // Per-cluster last refresh timestamps
  const lastRefreshTimes = ref<Record<string, Date | null>>({})

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

  // Centralized list of all available clusters (for all cluster selection menus)
  const allClusters = computed(() => {
    const githubAuthStore = useGitHubAuthStore()
    const sysConfigStore = useSysConfigStore()
    const clusters = new Set<string>()

    // Add current connected cluster
    if (sysConfigStore.cluster && sysConfigStore.cluster !== 'unknown') {
      clusters.add(sysConfigStore.cluster)
    }

    // Add known clusters (includes public 'sliderule')
    for (const c of githubAuthStore.knownClusters ?? []) {
      clusters.add(c)
    }

    // Add deployable clusters (exclude wildcard)
    for (const c of githubAuthStore.deployableClusters ?? []) {
      if (c !== '*') clusters.add(c)
    }

    // Add custom names
    for (const c of customNames.value) {
      clusters.add(c)
    }

    return Array.from(clusters).sort()
  })

  // Centralized list of all subdomains (for Connection interface)
  const allSubdomains = computed(() => {
    const githubAuthStore = useGitHubAuthStore()
    const sysConfigStore = useSysConfigStore()
    const subdomains = new Set<string>()

    // Add current connected subdomain
    if (sysConfigStore.subdomain && sysConfigStore.subdomain !== 'unknown') {
      subdomains.add(sysConfigStore.subdomain)
    }

    // Add known clusters as subdomains
    for (const c of githubAuthStore.knownClusters ?? []) {
      subdomains.add(c)
    }

    // Add custom names (same for both clusters and subdomains)
    for (const n of customNames.value) {
      subdomains.add(n)
    }

    return Array.from(subdomains).sort()
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

  function updateLastRefreshTime(cluster: string) {
    lastRefreshTimes.value[cluster] = new Date()
  }

  function getLastRefreshTime(cluster: string): Date | null {
    return lastRefreshTimes.value[cluster] ?? null
  }

  // Add a custom name to the list (if not already present)
  function addCustomName(name: string) {
    if (name && !customNames.value.includes(name)) {
      customNames.value.push(name)
    }
  }

  // Remove a custom name from the list
  function removeCustomName(name: string) {
    const index = customNames.value.indexOf(name)
    if (index !== -1) {
      customNames.value.splice(index, 1)
    }
  }

  return {
    selectedCluster,
    customNames,
    allClusters,
    allSubdomains,
    autoRefreshEnabled,
    autoRefreshMessage,
    autoRefreshClusters,
    autoRefreshMessages,
    lastRefreshTimes,
    setSelectedCluster,
    clearSelectedCluster,
    setAutoRefreshEnabled,
    isAutoRefreshEnabledForCluster,
    enableAutoRefresh,
    disableAutoRefresh,
    clearAutoRefreshMessage,
    updateLastRefreshTime,
    getLastRefreshTime,
    addCustomName,
    removeCustomName
  }
})
