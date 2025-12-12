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
    const organization = ref('sliderule')
    const desired_nodes = ref(1)
    const time_to_live = ref(720) // minutes
    const min_nodes = ref(0)
    const max_nodes = ref(0)
    const current_nodes = ref(-1)
    const version = ref('v?.?.?')
    const canConnectVersion = ref<CanConnectStatus>('unknown')
    const canConnectNodes = ref<CanConnectStatus>('unknown')

    async function fetchServerVersionInfo(): Promise<string> {
      const result = await fetchVersionUtil(organization.value, domain.value)
      canConnectVersion.value = result.success ? 'yes' : 'no'
      if (result.success) {
        version.value = result.version
      }
      return result.success ? result.data : 'Unknown'
    }

    async function fetchCurrentNodes(): Promise<string> {
      const result = await fetchNodesUtil(organization.value, domain.value)
      canConnectNodes.value = result.success ? 'yes' : 'no'
      if (result.success) {
        current_nodes.value = result.nodes
      }
      return result.success && result.nodes >= 0 ? result.nodes.toString() : 'Unknown'
    }

    return {
      domain,
      organization,
      desired_nodes,
      time_to_live,
      min_nodes,
      max_nodes,
      current_nodes,
      version,
      canConnectVersion,
      canConnectNodes,
      fetchServerVersionInfo,
      fetchCurrentNodes
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['domain', 'organization', 'desired_nodes', 'time_to_live']
    }
  }
)
