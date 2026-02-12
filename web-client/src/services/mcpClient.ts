import { createLogger } from '@/utils/logger'
import { useMcpStore } from '@/stores/mcpStore'
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
  const url = `ws://localhost:${mcpStore.wsPort}`
  mcpStore.setStatus('connecting')
  logger.info('Connecting to MCP server', url)

  ws = new WebSocket(url)

  ws.onopen = () => {
    logger.info('WebSocket connected')
    mcpStore.setStatus('connected')
  }

  ws.onmessage = async (event: MessageEvent) => {
    let request
    try {
      request = JSON.parse(event.data as string)
    } catch {
      logger.error('Failed to parse incoming message')
      return
    }

    if (!request.jsonrpc || !request.id || !request.method) {
      logger.warn('Received non-JSON-RPC message', request)
      return
    }

    const response = await handleJsonRpcRequest(request)

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

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}
