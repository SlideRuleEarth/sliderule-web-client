import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SysConfigStore')

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
      const url = `https://${organization.value}.${domain.value}/source/version`
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

        const data = await response.json()
        if (data === null || typeof data?.server.version !== 'string') {
          logger.error('Invalid response format from server version', { data })
          throw new Error('Invalid response format')
        }
        canConnectVersion.value = 'yes'
        version.value = data.server.version
        return data
      } catch (error) {
        logger.error('Error fetching server version', {
          error: error instanceof Error ? error.message : String(error)
        })
        canConnectVersion.value = 'no'
        return 'Unknown'
      }
    }

    async function fetchCurrentNodes(): Promise<string> {
      const url = `https://${organization.value}.${domain.value}/discovery/status`
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'sliderule' })
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

        const data = await response.json()
        if (typeof data?.nodes === 'number') {
          current_nodes.value = data.nodes
        } else {
          logger.error('Invalid response format from current nodes', { data })
          throw new Error('Invalid response format')
        }
        canConnectNodes.value = 'yes'
        return current_nodes.value >= 0 ? current_nodes.value.toString() : 'Unknown'
      } catch (error) {
        logger.error('Error fetching current nodes', {
          error: error instanceof Error ? error.message : String(error)
        })
        canConnectNodes.value = 'no'
        return 'Unknown'
      }
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
