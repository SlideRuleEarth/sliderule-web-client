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
    const desired_nodes = ref(1)
    const time_to_live = ref(720) // minutes
    const min_nodes = ref(0)
    const max_nodes = ref(0)
    const current_nodes = ref(-1)
    const version = ref('v?.?.?')
    const cluster = ref('unknown')
    const canConnectVersion = ref<CanConnectStatus>('unknown')
    const canConnectNodes = ref<CanConnectStatus>('unknown')

    function resetStatus() {
      version.value = 'v?.?.?'
      cluster.value = 'unknown'
      current_nodes.value = -1
      canConnectVersion.value = 'unknown'
      canConnectNodes.value = 'unknown'
    }

    async function fetchServerVersionInfo(): Promise<string> {
      const result = await fetchVersionUtil(subdomain.value, domain.value)
      canConnectVersion.value = result.success ? 'yes' : 'no'
      if (result.success) {
        version.value = result.version
        cluster.value = result.cluster
      } else {
        // Explicitly clear stale values on failure to prevent showing old cluster info in red
        version.value = 'v?.?.?'
        cluster.value = 'unknown'
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
      desired_nodes,
      time_to_live,
      min_nodes,
      max_nodes,
      current_nodes,
      version,
      cluster,
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
      pick: ['domain', 'subdomain', 'desired_nodes', 'time_to_live']
    }
  }
)
