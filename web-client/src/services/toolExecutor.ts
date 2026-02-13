import { createLogger } from '@/utils/logger'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { app } from '@/main'
import { toolDefinitions, type ToolDefinition } from './toolDefinitions'
import { iceSat2APIsItems, gediAPIsItems } from '@/types/SrStaticOptions'
import { mapGtStringsToSrListNumberItems, gtsOptions } from '@/utils/parmUtils'

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

// ── Helpers ─────────────────────────────────────────────────────

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function err(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

// ── Tool Handlers ────────────────────────────────────────────────

async function handleSetMission(args: Record<string, unknown>): Promise<ToolResult> {
  const mission = args.mission as string
  if (mission !== 'ICESat-2' && mission !== 'GEDI') {
    return Promise.resolve(err(`Invalid mission "${mission}". Must be "ICESat-2" or "GEDI".`))
  }
  const store = useReqParamsStore()
  store.setMissionValue(mission)
  const currentApi = store.getCurAPIStr()
  return Promise.resolve(ok(`Mission set to ${mission}. Active API is now "${currentApi}".`))
}

async function handleSetApi(args: Record<string, unknown>): Promise<ToolResult> {
  const api = args.api as string
  const store = useReqParamsStore()
  const mission = store.missionValue

  if (mission === 'ICESat-2') {
    if (!iceSat2APIsItems.includes(api)) {
      return Promise.resolve(
        err(`Invalid ICESat-2 API "${api}". Valid options: ${iceSat2APIsItems.join(', ')}`)
      )
    }
    store.setIceSat2API(api)
  } else if (mission === 'GEDI') {
    if (!gediAPIsItems.includes(api)) {
      return Promise.resolve(
        err(`Invalid GEDI API "${api}". Valid options: ${gediAPIsItems.join(', ')}`)
      )
    }
    store.setGediAPI(api)
  } else {
    return Promise.resolve(err(`Unknown mission "${mission}". Set mission first.`))
  }

  return Promise.resolve(ok(`API set to "${api}" for ${mission}.`))
}

async function handleSetTimeRange(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const t0Raw = args.t0 as string | undefined
  const t1Raw = args.t1 as string | undefined

  if (!t0Raw && !t1Raw) {
    return Promise.resolve(err('At least one of "t0" or "t1" must be provided.'))
  }

  let t0Date: Date | undefined
  let t1Date: Date | undefined

  if (t0Raw) {
    t0Date = new Date(t0Raw)
    if (isNaN(t0Date.getTime())) {
      return Promise.resolve(err(`Invalid t0 date: "${t0Raw}". Use ISO 8601 format.`))
    }
  }
  if (t1Raw) {
    t1Date = new Date(t1Raw)
    if (isNaN(t1Date.getTime())) {
      return Promise.resolve(err(`Invalid t1 date: "${t1Raw}". Use ISO 8601 format.`))
    }
  }
  if (t0Date && t1Date && t0Date >= t1Date) {
    return Promise.resolve(err(`t0 (${t0Raw}) must be before t1 (${t1Raw}).`))
  }

  store.setEnableGranuleSelection(true)
  store.setUseTime(true)
  if (t0Date) store.setT0(t0Date)
  if (t1Date) store.setT1(t1Date)

  const parts: string[] = []
  if (t0Date) parts.push(`t0=${t0Date.toISOString()}`)
  if (t1Date) parts.push(`t1=${t1Date.toISOString()}`)
  return Promise.resolve(ok(`Time range set: ${parts.join(', ')}. Granule selection enabled.`))
}

async function handleSetRgt(args: Record<string, unknown>): Promise<ToolResult> {
  const rgt = args.rgt as number
  if (!Number.isInteger(rgt) || rgt < 1 || rgt > 1387) {
    return Promise.resolve(err(`Invalid RGT "${rgt}". Must be an integer from 1 to 1387.`))
  }
  const store = useReqParamsStore()
  store.setEnableGranuleSelection(true)
  store.setUseRgt(true)
  store.setRgt(rgt)
  return Promise.resolve(ok(`RGT set to ${rgt}. Granule selection enabled.`))
}

async function handleSetCycle(args: Record<string, unknown>): Promise<ToolResult> {
  const cycle = args.cycle as number
  if (!Number.isInteger(cycle) || cycle < 1) {
    return Promise.resolve(err(`Invalid cycle "${cycle}". Must be a positive integer.`))
  }
  const store = useReqParamsStore()
  store.setEnableGranuleSelection(true)
  store.setUseCycle(true)
  store.setCycle(cycle)
  return Promise.resolve(ok(`Cycle set to ${cycle}. Granule selection enabled.`))
}

async function handleSetBeams(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const mission = store.missionValue
  const beamsArg = args.beams

  if (mission === 'ICESat-2') {
    if (beamsArg === 'all') {
      store.setEnableGranuleSelection(true)
      store.setSelectAllBeams(true)
      store.setSelectedGtOptions([...gtsOptions])
      return Promise.resolve(
        ok('All ICESat-2 beams selected (gt1l, gt1r, gt2l, gt2r, gt3l, gt3r).')
      )
    }

    if (!Array.isArray(beamsArg) || beamsArg.length === 0) {
      return Promise.resolve(
        err('Beams must be "all" or an array of beam names (e.g. ["gt1l", "gt2r"]).')
      )
    }

    const mapped = mapGtStringsToSrListNumberItems(beamsArg as (string | number)[])
    if (mapped.length === 0) {
      const validNames = gtsOptions.map((g) => g.label).join(', ')
      return Promise.resolve(err(`No valid beams found. Valid ICESat-2 beams: ${validNames}`))
    }

    store.setEnableGranuleSelection(true)
    store.setSelectAllBeams(mapped.length === gtsOptions.length)
    store.setSelectedGtOptions(mapped)
    const names = mapped.map((b) => b.label).join(', ')
    return Promise.resolve(ok(`ICESat-2 beams set: ${names}. Granule selection enabled.`))
  } else if (mission === 'GEDI') {
    const validGediBeams = [0, 1, 2, 3, 5, 6, 8, 11]

    if (beamsArg === 'all') {
      store.gediBeams = [...validGediBeams]
      return Promise.resolve(ok(`All GEDI beams selected: ${validGediBeams.join(', ')}.`))
    }

    if (!Array.isArray(beamsArg) || beamsArg.length === 0) {
      return Promise.resolve(
        err(
          `Beams must be "all" or an array of beam numbers. Valid GEDI beams: ${validGediBeams.join(', ')}`
        )
      )
    }

    const invalid = (beamsArg as number[]).filter((b) => !validGediBeams.includes(b))
    if (invalid.length > 0) {
      return Promise.resolve(
        err(`Invalid GEDI beam(s): ${invalid.join(', ')}. Valid: ${validGediBeams.join(', ')}`)
      )
    }

    store.gediBeams = beamsArg as number[]
    return Promise.resolve(ok(`GEDI beams set: ${(beamsArg as number[]).join(', ')}.`))
  }

  return Promise.resolve(err(`Unknown mission "${mission}". Set mission first.`))
}

async function handleSetSurfaceFit(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const enabled = args.enabled as boolean

  store.setUseSurfaceFitAlgorithm(enabled) // auto-disables PhoREAL

  if (!enabled) {
    return Promise.resolve(ok('Surface fit algorithm disabled.'))
  }

  const details: string[] = ['Surface fit algorithm enabled.']

  if (args.max_iterations !== undefined) {
    const v = args.max_iterations as number
    store.setUseMaxIterations(true)
    store.setMaxIterations(v)
    details.push(`max_iterations=${v}`)
  }
  if (args.min_window_height !== undefined) {
    const v = args.min_window_height as number
    store.setUseMinWindowHeight(true)
    store.setMinWindowHeight(v)
    details.push(`min_window_height=${v}`)
  }
  if (args.sigma_r_max !== undefined) {
    const v = args.sigma_r_max as number
    store.setUseMaxRobustDispersion(true)
    store.setSigmaRmax(v)
    details.push(`sigma_r_max=${v}`)
  }

  return Promise.resolve(ok(details.join(' ')))
}

async function handleSetPhotonParams(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const { length, step, along_track_spread, min_photon_count } = args as {
    length?: number
    step?: number
    along_track_spread?: number
    min_photon_count?: number
  }

  if (
    length === undefined &&
    step === undefined &&
    along_track_spread === undefined &&
    min_photon_count === undefined
  ) {
    return Promise.resolve(err('At least one photon parameter must be provided.'))
  }

  const details: string[] = []

  if (length !== undefined) {
    store.setUseLength(true)
    store.setLengthValue(length)
    details.push(`length=${length}m`)
  }
  if (step !== undefined) {
    store.setUseStep(true)
    store.setStepValue(step)
    details.push(`step=${step}m`)
  }
  if (along_track_spread !== undefined) {
    store.setUseAlongTrackSpread(true)
    store.setAlongTrackSpread(along_track_spread)
    details.push(`along_track_spread=${along_track_spread}`)
  }
  if (min_photon_count !== undefined) {
    store.setUseMinimumPhotonCount(true)
    store.setMinimumPhotonCount(min_photon_count)
    details.push(`min_photon_count=${min_photon_count}`)
  }

  return Promise.resolve(ok(`Photon parameters set: ${details.join(', ')}.`))
}

async function handleSetYapc(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const enabled = args.enabled as boolean

  store.enableYAPC = enabled

  if (!enabled) {
    return Promise.resolve(ok('YAPC disabled.'))
  }

  const details: string[] = ['YAPC enabled.']

  if (args.score !== undefined) {
    const v = args.score as number
    store.setUseYAPCScore(true)
    store.setYAPCScore(v)
    details.push(`score=${v}`)
  }
  if (args.knn !== undefined) {
    const v = args.knn as number
    store.setUseYAPCKnn(true)
    store.setYAPCKnn(v)
    details.push(`knn=${v}`)
  }
  if (args.window_height !== undefined) {
    const v = args.window_height as number
    store.setUsesYAPCWindowHeight(true)
    store.setYAPCWindowHeight(v)
    details.push(`window_height=${v}`)
  }
  if (args.window_width !== undefined) {
    const v = args.window_width as number
    store.setUsesYAPCWindowWidth(true)
    store.setYAPCWindowWidth(v)
    details.push(`window_width=${v}`)
  }
  if (args.version !== undefined) {
    const v = args.version as number
    store.setYAPCVersion(v)
    details.push(`version=${v}`)
  }

  return Promise.resolve(ok(details.join(' ')))
}

async function handleSetOutputConfig(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const details: string[] = []

  if (args.file_output !== undefined) {
    store.fileOutput = args.file_output as boolean
    details.push(`file_output=${args.file_output}`)
  }
  if (args.geo_parquet !== undefined) {
    store.isGeoParquet = args.geo_parquet as boolean
    details.push(`geo_parquet=${args.geo_parquet}`)
  }
  if (args.checksum !== undefined) {
    store.useChecksum = args.checksum as boolean
    details.push(`checksum=${args.checksum}`)
  }

  if (details.length === 0) {
    return Promise.resolve(err('At least one output config parameter must be provided.'))
  }

  return Promise.resolve(ok(`Output config updated: ${details.join(', ')}.`))
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
      rgt: { enabled: store.useRGT, value: store.rgtValue },
      cycle: { enabled: store.useCycle, value: store.cycleValue }
    },
    beams: {
      icesat2: store.beams.map((b) => b.label),
      gedi: store.gediBeams
    },
    surfaceFit: {
      enabled: store.useSurfaceFitAlgorithm,
      maxIterations: store.useMaxIterations ? store.maxIterations : null,
      minWindowHeight: store.useMinWindowHeight ? store.minWindowHeight : null,
      sigmaRMax: store.useMaxRobustDispersion ? store.maxRobustDispersion : null
    },
    photonParams: {
      length: store.useLength ? store.lengthValue : null,
      step: store.useStep ? store.stepValue : null,
      alongTrackSpread: store.useAlongTrackSpread ? store.alongTrackSpread : null,
      minPhotonCount: store.useMinimumPhotonCount ? store.minimumPhotonCount : null
    },
    yapc: {
      enabled: store.enableYAPC,
      score: store.YAPCScore,
      knn: store.usesYAPCKnn ? store.YAPCKnn : null,
      windowHeight: store.usesYAPCWindowHeight ? store.YAPCWindowHeight : null,
      windowWidth: store.usesYAPCWindowWidth ? store.YAPCWindowWidth : null,
      version: store.YAPCVersion
    },
    output: {
      fileOutput: store.fileOutput,
      geoParquet: store.isGeoParquet,
      checksum: store.useChecksum
    }
  }
  return Promise.resolve(ok(JSON.stringify(params, null, 2)))
}

async function handleResetParams(): Promise<ToolResult> {
  return new Promise((resolve) => {
    const confirmService = app.config.globalProperties.$confirm

    if (!confirmService) {
      logger.error('ConfirmationService not available')
      resolve(err('ConfirmationService not available in the browser.'))
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
        resolve(ok('All parameters have been reset to defaults.'))
      },
      reject: () => {
        logger.info('User denied MCP reset_params')
        resolve(err('User denied the reset operation.'))
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

// ── Register all tools ──────────────────────────────────────────

const handlers: Record<string, ToolHandler> = {
  set_mission: handleSetMission,
  set_api: handleSetApi,
  set_time_range: handleSetTimeRange,
  set_rgt: handleSetRgt,
  set_cycle: handleSetCycle,
  set_beams: handleSetBeams,
  set_surface_fit: handleSetSurfaceFit,
  set_photon_params: handleSetPhotonParams,
  set_yapc: handleSetYapc,
  set_output_config: handleSetOutputConfig,
  get_current_params: handleGetCurrentParams,
  reset_params: handleResetParams
}

for (const def of toolDefinitions) {
  const handler = handlers[def.name]
  if (handler) {
    registerTool(def, handler)
  }
}
