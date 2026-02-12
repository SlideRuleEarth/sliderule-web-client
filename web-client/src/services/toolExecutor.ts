import { createLogger } from '@/utils/logger'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { app } from '@/main'
import { toolDefinitions, type ToolDefinition } from './toolDefinitions'

const logger = createLogger('ToolExecutor')

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

type ToolHandler = (_args: Record<string, unknown>) => Promise<ToolResult>

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

const toolRegistry = new Map<string, RegisteredTool>()

function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  toolRegistry.set(definition.name, { definition, handler })
  logger.debug('Registered tool', definition.name)
}

// ── Tool Handlers ────────────────────────────────────────────────

async function handleSetMission(args: Record<string, unknown>): Promise<ToolResult> {
  const mission = args.mission as string
  if (mission !== 'ICESat-2' && mission !== 'GEDI') {
    return Promise.resolve({
      content: [
        { type: 'text', text: `Invalid mission "${mission}". Must be "ICESat-2" or "GEDI".` }
      ],
      isError: true
    })
  }
  const store = useReqParamsStore()
  store.setMissionValue(mission)
  const currentApi = store.getCurAPIStr()
  return Promise.resolve({
    content: [
      { type: 'text', text: `Mission set to ${mission}. Active API is now "${currentApi}".` }
    ]
  })
}

async function handleGetCurrentParams(): Promise<ToolResult> {
  const store = useReqParamsStore()
  const params = {
    mission: store.missionValue,
    api: store.getCurAPIStr(),
    url: store.urlValue,
    hasRegion: store.poly !== null && store.poly.length > 0,
    areaOfConvexHull: store.areaOfConvexHull,
    timeRange: {
      enabled: store.useTime,
      t0: store.t0Value,
      t1: store.t1Value
    },
    granuleSelection: {
      enabled: store.enableGranuleSelection,
      rgt: store.rgtValue,
      cycle: store.cycleValue
    },
    surfaceFit: store.useSurfaceFitAlgorithm,
    yapc: store.enableYAPC,
    fileOutput: store.fileOutput
  }
  return Promise.resolve({
    content: [{ type: 'text', text: JSON.stringify(params, null, 2) }]
  })
}

async function handleResetParams(): Promise<ToolResult> {
  return new Promise((resolve) => {
    const confirmService = app.config.globalProperties.$confirm

    if (!confirmService) {
      logger.error('ConfirmationService not available')
      resolve({
        content: [{ type: 'text', text: 'ConfirmationService not available in the browser.' }],
        isError: true
      })
      return
    }

    confirmService.require({
      group: 'mcp',
      message: 'Claude is requesting to reset all parameters to defaults. Allow this?',
      header: 'MCP: Reset Parameters',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Deny',
      acceptLabel: 'Allow',
      rejectClass: 'p-button-secondary',
      acceptClass: 'p-button-danger',
      accept: () => {
        const store = useReqParamsStore()
        store.reset()
        logger.info('Parameters reset via MCP')
        resolve({
          content: [{ type: 'text', text: 'All parameters have been reset to defaults.' }]
        })
      },
      reject: () => {
        logger.info('User denied MCP reset_params')
        resolve({
          content: [{ type: 'text', text: 'User denied the reset operation.' }],
          isError: true
        })
      }
    })
  })
}

// ── Validation ───────────────────────────────────────────────────

function validateArgs(toolName: string, args: Record<string, unknown>): string | null {
  const tool = toolRegistry.get(toolName)
  if (!tool) return `Unknown tool: ${toolName}`

  const schema = tool.definition.inputSchema
  const required = schema.required || []

  for (const req of required) {
    if (!(req in args)) {
      return `Missing required argument: "${req}"`
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const propSchema = schema.properties[key] as Record<string, unknown> | undefined
    if (propSchema?.enum && !(propSchema.enum as unknown[]).includes(value)) {
      return `Invalid value for "${key}": "${value}". Must be one of: ${(propSchema.enum as unknown[]).join(', ')}`
    }
  }

  return null
}

// ── Public API ───────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolName)
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: "${toolName}"` }],
      isError: true
    }
  }

  const validationError = validateArgs(toolName, args)
  if (validationError) {
    return {
      content: [{ type: 'text', text: validationError }],
      isError: true
    }
  }

  try {
    return await tool.handler(args)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Tool execution failed', { toolName, error: msg })
    return {
      content: [{ type: 'text', text: `Tool "${toolName}" failed: ${msg}` }],
      isError: true
    }
  }
}

export function getToolDefinitions(): ToolDefinition[] {
  return toolDefinitions
}

// ── Register MVP 0 tools ────────────────────────────────────────

const handlers: Record<string, ToolHandler> = {
  set_mission: handleSetMission,
  get_current_params: handleGetCurrentParams,
  reset_params: handleResetParams
}

for (const def of toolDefinitions) {
  const handler = handlers[def.name]
  if (handler) {
    registerTool(def, handler)
  }
}
