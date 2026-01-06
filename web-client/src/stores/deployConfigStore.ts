import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchServerVersionInfo as fetchVersionUtil,
  fetchCurrentNodes as fetchNodesUtil,
  type StackStatus
} from '@/utils/fetchUtils'

type CanConnectStatus = 'unknown' | 'yes' | 'no'

/**
 * Status values that indicate a cluster should be disabled for selection.
 * These states mean the cluster is either starting, running, or in transition.
 */
const DISABLED_STACK_STATUSES: StackStatus[] = [
  'CREATE_IN_PROGRESS',
  'CREATE_COMPLETE',
  'UPDATE_IN_PROGRESS',
  'DELETE_IN_PROGRESS'
]

export const useDeployConfigStore = defineStore(
  'deployConfig',
  () => {
    const domain = ref('slideruleearth.io')
    const clusterName = ref('')
    const desiredVersion = ref('latest')
    const version = ref('')
    const numberOfNodes = ref(7)
    const ttl = ref(1)
    const isPublic = ref(false)
    const currentNodes = ref(-1)
    const canConnectVersion = ref<CanConnectStatus>('unknown')
    const canConnectNodes = ref<CanConnectStatus>('unknown')
    const clusterStackStatus = ref<Record<string, StackStatus>>({})

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

    /**
     * Check if a cluster should be disabled based on its stack status.
     */
    function isClusterDisabled(cluster: string): boolean {
      const status = clusterStackStatus.value[cluster]
      if (!status) return false // Unknown status = allow selection
      return DISABLED_STACK_STATUSES.includes(status)
    }

    /**
     * Get a human-readable label for the stack status.
     */
    function getStackStatusLabel(cluster: string): string {
      const status = clusterStackStatus.value[cluster]
      switch (status) {
        case 'CREATE_IN_PROGRESS':
          return 'Starting...'
        case 'CREATE_COMPLETE':
          return 'Running'
        case 'UPDATE_IN_PROGRESS':
          return 'Updating...'
        case 'DELETE_IN_PROGRESS':
          return 'Stopping...'
        case 'DELETE_COMPLETE':
          return 'Stopped'
        case 'NOT_FOUND':
          return 'Not deployed'
        case 'FAILED':
          return 'Failed'
        case 'UNKNOWN':
        default:
          return ''
      }
    }

    return {
      domain,
      clusterName,
      desiredVersion,
      version,
      numberOfNodes,
      ttl,
      isPublic,
      currentNodes,
      canConnectVersion,
      canConnectNodes,
      clusterStackStatus,
      resetStatus,
      fetchServerVersionInfo,
      fetchCurrentNodes,
      isClusterDisabled,
      getStackStatusLabel
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['domain', 'clusterName', 'desiredVersion', 'numberOfNodes', 'ttl', 'isPublic']
    }
  }
)
