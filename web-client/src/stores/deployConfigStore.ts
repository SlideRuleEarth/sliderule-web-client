import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchServerVersionInfo as fetchVersionUtil,
  fetchCurrentNodes as fetchNodesUtil
} from '@/utils/fetchUtils'

type CanConnectStatus = 'unknown' | 'yes' | 'no'

export const useDeployConfigStore = defineStore(
  'deployConfig',
  () => {
    const domain = ref('slideruleearth.io')
    const clusterName = ref('')
    const version = ref('')
    const numberOfNodes = ref(1)
    const currentNodes = ref(-1)
    const canConnectVersion = ref<CanConnectStatus>('unknown')
    const canConnectNodes = ref<CanConnectStatus>('unknown')

    function resetStatus() {
      version.value = ''
      currentNodes.value = -1
      canConnectVersion.value = 'unknown'
      canConnectNodes.value = 'unknown'
    }

    async function fetchServerVersionInfo(): Promise<string> {
      const result = await fetchVersionUtil(clusterName.value, domain.value)
      canConnectVersion.value = result.success ? 'yes' : 'no'
      if (result.success) {
        version.value = result.version
      }
      return result.success ? result.data : 'Unknown'
    }

    async function fetchCurrentNodes(): Promise<string> {
      const result = await fetchNodesUtil(clusterName.value, domain.value)
      canConnectNodes.value = result.success ? 'yes' : 'no'
      if (result.success) {
        currentNodes.value = result.nodes
      }
      return result.success && result.nodes >= 0 ? result.nodes.toString() : 'Unknown'
    }

    return {
      domain,
      clusterName,
      version,
      numberOfNodes,
      currentNodes,
      canConnectVersion,
      canConnectNodes,
      resetStatus,
      fetchServerVersionInfo,
      fetchCurrentNodes
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['domain', 'clusterName', 'version', 'numberOfNodes']
    }
  }
)
