import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useClusterSelectionStore = defineStore('clusterSelection', () => {
  const selectedCluster = ref<string>('')
  const autoRefreshEnabled = ref(false)
  const lastRefreshTime = ref<Date | null>(null)

  function setSelectedCluster(cluster: string) {
    selectedCluster.value = cluster
  }

  function clearSelectedCluster() {
    selectedCluster.value = ''
  }

  function setAutoRefreshEnabled(enabled: boolean) {
    autoRefreshEnabled.value = enabled
  }

  function updateLastRefreshTime() {
    lastRefreshTime.value = new Date()
  }

  return {
    selectedCluster,
    autoRefreshEnabled,
    lastRefreshTime,
    setSelectedCluster,
    clearSelectedCluster,
    setAutoRefreshEnabled,
    updateLastRefreshTime
  }
})
