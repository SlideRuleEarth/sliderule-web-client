import { createLogger } from '@/utils/logger'
import { useMcpStore } from '@/stores/mcpStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { handleJsonRpcRequest } from './mcpHandler'

const logger = createLogger('McpClient')

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let manualDisconnect = false

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

function getReconnectDelay(attempts: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1)
  return Math.round(delay + jitter)
}

export function connect(): void {
  const mcpStore = useMcpStore()

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    logger.warn('Already connected or connecting')
    return
  }

  manualDisconnect = false
  let url: string

  let cloudToken: string | null = null

  if (mcpStore.isCloudMode) {
    const authStore = useGitHubAuthStore()
    cloudToken = authStore.authToken
    if (!cloudToken) {
      mcpStore.setError('GitHub login required for cloud MCP connection')
      mcpStore.setStatus('disconnected')
      return
    }
    url = mcpStore.mcpWsUrl
    if (!url.startsWith('wss://')) {
      mcpStore.setError('Cloud MCP requires a secure wss:// WebSocket URL')
      mcpStore.setStatus('disconnected')
      return
    }
  } else {
    url = `ws://localhost:${mcpStore.wsPort}`
  }

  mcpStore.setStatus('connecting')
  logger.info('Connecting to MCP server', mcpStore.isCloudMode ? mcpStore.mcpWsUrl : url)

  ws = new WebSocket(url)

  ws.onopen = () => {
    if (cloudToken && ws) {
      // Send JWT as first message instead of query param (avoids token in logs)
      ws.send(JSON.stringify({ type: 'auth', token: cloudToken }))
    } else {
      logger.info('WebSocket connected')
      mcpStore.setStatus('connected')
    }
  }

  ws.onmessage = async (event: MessageEvent) => {
    let msg
    try {
      msg = JSON.parse(event.data as string)
    } catch {
      logger.error('Failed to parse incoming message')
      return
    }

    // Handle auth acknowledgment from cloud server
    if (msg.type === 'auth') {
      if (msg.status === 'ok') {
        logger.info('WebSocket authenticated')
        mcpStore.setStatus('connected')
      } else {
        logger.error('WebSocket auth failed')
        mcpStore.setError('MCP authentication failed')
      }
      return
    }

    if (!msg.jsonrpc || !msg.id || !msg.method) {
      logger.warn('Received non-JSON-RPC message', msg)
      return
    }

    const response = await handleJsonRpcRequest(msg)

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response))
    } else {
      logger.error('Cannot send response: WebSocket not open')
    }
  }

  ws.onclose = (event: CloseEvent) => {
    logger.info('WebSocket closed', { code: event.code, reason: event.reason })
    ws = null

    if (manualDisconnect) {
      mcpStore.setStatus('disconnected')
      return
    }

    // Server closed with 4000 = "Replaced by new connection" (another tab took over)
    if (event.code === 4000) {
      mcpStore.setStatus('disconnected')
      mcpStore.setError(
        'MCP connection taken by another browser tab. Only one tab can be connected at a time.'
      )
      logger.info('Connection replaced by another client, not reconnecting')
      return
    }

    mcpStore.setStatus('reconnecting')
    mcpStore.incrementReconnectAttempts()
    const delay = getReconnectDelay(mcpStore.reconnectAttempts)
    logger.info('Scheduling reconnect', { attempt: mcpStore.reconnectAttempts, delayMs: delay })

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  ws.onerror = () => {
    mcpStore.setError('WebSocket connection error')
  }
}

export function disconnect(): void {
  manualDisconnect = true

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (ws) {
    ws.close(1000, 'User disconnected')
    ws = null
  }

  const mcpStore = useMcpStore()
  mcpStore.setStatus('disconnected')
  logger.info('Manually disconnected')
}

export function reconnect(): void {
  disconnect()
  connect()
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}
