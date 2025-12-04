import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SysConfigStore')

type CanConnectStatus = 'unknown' | 'yes' | 'no'

export const useSysConfigStore = defineStore('sysConfig', {
  state: () => ({
    domain: 'slideruleearth.io',
    organization: 'sliderule',
    desired_nodes: 1,
    time_to_live: 720, // minutes
    min_nodes: 0,
    max_nodes: 0,
    current_nodes: -1,
    version: 'v?.?.?',
    canConnectVersion: 'unknown' as CanConnectStatus,
    canConnectNodes: 'unknown' as CanConnectStatus
  }),
  actions: {
    setDomain(value: string) {
      this.domain = value
    },
    getDomain(): string {
      return this.domain
    },
    setOrganization(value: string) {
      this.organization = value
    },
    getOrganization(): string {
      return this.organization
    },
    getTimeToLive(): number {
      return this.time_to_live
    },
    setTimeToLive(value: number) {
      this.time_to_live = value
    },
    setDesiredNodes(value: number) {
      this.desired_nodes = value
    },
    getDesiredNodes(): number {
      return this.desired_nodes
    },
    setMinNodes(value: number) {
      this.min_nodes = value
    },
    getMinNodes(): number {
      return this.min_nodes
    },
    setMaxNodes(value: number) {
      this.max_nodes = value
    },
    getMaxNodes(): number {
      return this.max_nodes
    },
    setCurrentNodes(value: number) {
      this.current_nodes = value
    },
    getCurrentNodes(): number {
      return this.current_nodes
    },
    setVersion(value: string) {
      this.version = value
    },
    getVersion(): string {
      return this.version
    },
    async fetchServerVersionInfo(): Promise<string> {
      const url = `https://${this.organization}.${this.domain}/source/version`
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

        const data = await response.json()
        if (data === null || typeof data?.server.version !== 'string') {
          logger.error('Invalid response format from server version', { data })
          throw new Error('Invalid response format')
        }
        this.setCanConnectVersion('yes')
        this.setVersion(data.server.version)
        return data
      } catch (error) {
        logger.error('Error fetching server version', {
          error: error instanceof Error ? error.message : String(error)
        })
        this.setCanConnectVersion('no')
        return 'Unknown'
      }
    },
    async fetchCurrentNodes(): Promise<string> {
      const url = `https://${this.organization}.${this.domain}/discovery/status`
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ service: 'sliderule' })
        })

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

        const data = await response.json()
        if (typeof data?.nodes === 'number') {
          this.current_nodes = data.nodes
        } else {
          logger.error('Invalid response format from current nodes', { data })
          throw new Error('Invalid response format')
        }
        this.setCanConnectNodes('yes')
        return this.current_nodes >= 0 ? this.current_nodes.toString() : 'Unknown'
      } catch (error) {
        logger.error('Error fetching current nodes', {
          error: error instanceof Error ? error.message : String(error)
        })
        this.setCanConnectNodes('no')
        return 'Unknown'
      }
    },
    setCanConnectVersion(value: CanConnectStatus) {
      this.canConnectVersion = value
    },
    getCanConnectVersion(): CanConnectStatus {
      return this.canConnectVersion
    },
    setCanConnectNodes(value: CanConnectStatus) {
      this.canConnectNodes = value
    },
    getCanConnectNodes(): CanConnectStatus {
      return this.canConnectNodes
    }
  },
  persist: {
    storage: localStorage,
    pick: ['domain', 'organization', 'desired_nodes', 'time_to_live']
  }
})
