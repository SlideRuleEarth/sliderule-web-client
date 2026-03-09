import { createLogger } from '@/utils/logger'
import { executeTool, getToolDefinitions } from './toolExecutor'
import { useMcpStore } from '@/stores/mcpStore'

const logger = createLogger('McpHandler')

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

class JsonRpcError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

export async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const mcpStore = useMcpStore()
  const startTime = Date.now()

  logger.debug('Handling request', { method: request.method, id: request.id })

  mcpStore.addActivity({
    direction: 'inbound',
    method: request.method,
    toolName: request.params?.name as string | undefined,
    summary: formatRequestSummary(request)
  })

  try {
    let result: unknown

    switch (request.method) {
      case 'tools/list':
        result = { tools: getToolDefinitions() }
        break

      case 'tools/call': {
        const toolName = request.params?.name as string
        const toolArgs = (request.params?.arguments ?? {}) as Record<string, unknown>
        if (!toolName) {
          throw new JsonRpcError(-32602, 'Missing tool name in params.name')
        }
        result = await executeTool(toolName, toolArgs)
        break
      }

      case 'resources/list': {
        const { listResources, listResourceTemplates } = await import('./resourceResolver')
        result = {
          resources: listResources(),
          resourceTemplates: listResourceTemplates()
        }
        break
      }

      case 'resources/read': {
        const uri = request.params?.uri as string
        if (!uri) {
          throw new JsonRpcError(-32602, 'Missing uri in params')
        }
        const { readResource } = await import('./resourceResolver')
        result = await readResource(uri)
        break
      }

      case 'prompts/list': {
        const { listPrompts } = await import('./promptTemplates')
        result = { prompts: listPrompts() }
        break
      }

      case 'prompts/get': {
        const promptName = request.params?.name as string
        const promptArgs = (request.params?.arguments ?? {}) as Record<string, string>
        if (!promptName) {
          throw new JsonRpcError(-32602, 'Missing prompt name in params.name')
        }
        const { getPrompt } = await import('./promptTemplates')
        result = getPrompt(promptName, promptArgs)
        break
      }

      case 'ping':
        result = {}
        break

      default:
        throw new JsonRpcError(-32601, `Method not found: ${request.method}`)
    }

    const durationMs = Date.now() - startTime
    mcpStore.addActivity({
      direction: 'outbound',
      method: request.method,
      toolName: request.params?.name as string | undefined,
      summary: formatResponseSummary(request.method, result),
      durationMs
    })

    return { jsonrpc: '2.0', id: request.id, result }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const code = error instanceof JsonRpcError ? error.code : -32603
    const message = error instanceof Error ? error.message : String(error)

    mcpStore.addActivity({
      direction: 'outbound',
      method: request.method,
      toolName: request.params?.name as string | undefined,
      summary: `Error: ${message}`,
      durationMs,
      isError: true
    })

    return { jsonrpc: '2.0', id: request.id, error: { code, message } }
  }
}

function formatRequestSummary(request: JsonRpcRequest): string {
  if (request.method === 'tools/call') {
    const toolName = request.params?.name as string
    const args = request.params?.arguments
    return `${toolName}(${args ? JSON.stringify(args) : ''})`
  }
  return request.method
}

function formatResponseSummary(method: string, result: unknown): string {
  if (method === 'tools/list') {
    const tools = (result as { tools?: unknown[] })?.tools
    return `Listed ${Array.isArray(tools) ? tools.length : 0} tools`
  }
  if (method === 'tools/call') {
    const content = (result as { content?: Array<{ text?: string }> })?.content
    if (Array.isArray(content) && content.length > 0) {
      const text = content[0]?.text || ''
      return text.length > 80 ? text.substring(0, 80) + '...' : text
    }
  }
  if (method === 'resources/list') {
    const resources = (result as { resources?: unknown[] })?.resources
    return `Listed ${Array.isArray(resources) ? resources.length : 0} resources`
  }
  if (method === 'resources/read') {
    const contents = (result as { contents?: Array<{ text?: string }> })?.contents
    if (Array.isArray(contents) && contents.length > 0) {
      const text = contents[0]?.text || ''
      return text.length > 80 ? text.substring(0, 80) + '...' : text
    }
  }
  if (method === 'prompts/list') {
    const prompts = (result as { prompts?: unknown[] })?.prompts
    return `Listed ${Array.isArray(prompts) ? prompts.length : 0} prompts`
  }
  if (method === 'prompts/get') {
    const messages = (result as { messages?: Array<{ content?: { text?: string } }> })?.messages
    if (Array.isArray(messages) && messages.length > 0) {
      const text = messages[0]?.content?.text || ''
      return text.length > 80 ? text.substring(0, 80) + '...' : text
    }
  }
  return 'OK'
}
