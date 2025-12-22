import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchServerVersionInfo as fetchVersionUtil,
  fetchCurrentNodes as fetchNodesUtil
} from '@/utils/fetchUtils'

type CanConnectStatus = 'unknown' | 'yes' | 'no'

export const useSysConfigStore = defineStore(
  'sysConfig',
  () => {
    const domain = ref('slideruleearth.io')
    const subdomain = ref('sliderule')
    const discoveredCluster = ref<string | null>(null) // cluster name returned by server API
    const desired_nodes = ref(1)
    const time_to_live = ref(720) // minutes
    const min_nodes = ref(0)
    const max_nodes = ref(0)
    const current_nodes = ref(-1)
    const version = ref('v?.?.?')
    const canConnectVersion = ref<CanConnectStatus>('unknown')
    const canConnectNodes = ref<CanConnectStatus>('unknown')

    function resetStatus() {
      version.value = 'v?.?.?'
      current_nodes.value = -1
      discoveredCluster.value = null
      canConnectVersion.value = 'unknown'
      canConnectNodes.value = 'unknown'
    }

    async function fetchServerVersionInfo(): Promise<string> {
      const result = await fetchVersionUtil(subdomain.value, domain.value)
      canConnectVersion.value = result.success ? 'yes' : 'no'
      if (result.success) {
        version.value = result.version
        // Capture the cluster name returned by the server
        if (result.data?.server?.cluster) {
          discoveredCluster.value = result.data.server.cluster
        }
      }
      return result.success ? result.data : 'Unknown'
    }

    async function fetchCurrentNodes(): Promise<string> {
      const result = await fetchNodesUtil(subdomain.value, domain.value)
      canConnectNodes.value = result.success ? 'yes' : 'no'
      if (result.success) {
        current_nodes.value = result.nodes
      }
      return result.success && result.nodes >= 0 ? result.nodes.toString() : 'Unknown'
    }

    async function resetToPublicDomain(): Promise<void> {
      // Set values directly (don't use $reset due to persistence plugin restoring old values)
      domain.value = 'slideruleearth.io'
      subdomain.value = 'sliderule'
      desired_nodes.value = 1
      time_to_live.value = 720
      resetStatus()
      await fetchServerVersionInfo()
      await fetchCurrentNodes()
    }

    return {
      domain,
      subdomain,
      discoveredCluster,
      desired_nodes,
      time_to_live,
      min_nodes,
      max_nodes,
      current_nodes,
      version,
      canConnectVersion,
      canConnectNodes,
      resetStatus,
      fetchServerVersionInfo,
      fetchCurrentNodes,
      resetToPublicDomain
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['domain', 'cluster', 'desired_nodes', 'time_to_live']
    }
  }
)
