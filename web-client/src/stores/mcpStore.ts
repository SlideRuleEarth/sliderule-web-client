import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('McpStore')

export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface McpActivityEntry {
  timestamp: number
  direction: 'inbound' | 'outbound'
  method: string
  toolName?: string
  summary: string
  durationMs?: number
  isError?: boolean
}

export const useMcpStore = defineStore('mcp', () => {
  const status = ref<McpConnectionStatus>('disconnected')
  const activityLog = ref<McpActivityEntry[]>([])
  const reconnectAttempts = ref(0)
  const lastError = ref<string | null>(null)
  const wsPort = ref(parseInt(import.meta.env.VITE_MCP_WS_PORT || '3002'))

  const isConnected = computed(() => status.value === 'connected')
  const recentActivity = computed(() => activityLog.value.slice(-50))
  const toolCallCount = computed(
    () =>
      activityLog.value.filter((e) => e.method === 'tools/call' && e.direction === 'inbound').length
  )

  function setStatus(newStatus: McpConnectionStatus) {
    logger.debug('Status changed', { from: status.value, to: newStatus })
    status.value = newStatus
    if (newStatus === 'connected') {
      reconnectAttempts.value = 0
      lastError.value = null
    }
  }

  function addActivity(entry: Omit<McpActivityEntry, 'timestamp'>) {
    activityLog.value.push({ ...entry, timestamp: Date.now() })
    if (activityLog.value.length > 200) {
      activityLog.value = activityLog.value.slice(-100)
    }
  }

  function incrementReconnectAttempts() {
    reconnectAttempts.value++
  }

  function setError(error: string) {
    lastError.value = error
    logger.warn('MCP error', error)
  }

  function setWsPort(port: number) {
    wsPort.value = port
  }

  function clearLog() {
    activityLog.value = []
  }

  return {
    status,
    activityLog,
    reconnectAttempts,
    lastError,
    wsPort,
    isConnected,
    recentActivity,
    toolCallCount,
    setStatus,
    addActivity,
    incrementReconnectAttempts,
    setError,
    setWsPort,
    clearLog
  }
})
