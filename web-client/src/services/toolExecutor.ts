import { createLogger } from '@/utils/logger'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRequestsStore } from '@/stores/requestsStore'
import { useServerStateStore } from '@/stores/serverStateStore'
import { app } from '@/main'
import { toolDefinitions, type ToolDefinition } from './toolDefinitions'
import { iceSat2APIsItems, gediAPIsItems } from '@/types/SrStaticOptions'
import { mapGtStringsToSrListNumberItems, gtsOptions } from '@/utils/parmUtils'
import { regionFromBounds, convexHull, calculatePolygonArea } from '@/composables/SrTurfUtils'
import { extractSrRegionFromGeometry } from '@/utils/geojsonUploader'
import { useAreaThresholdsStore } from '@/stores/areaThresholdsStore'
// workerDomUtils and SrDuckDbUtils use module-level Pinia store calls
// (transitively via SrMapUtils), so they cannot be imported statically here
// (toolExecutor loads before Pinia is ready).
// Use dynamic import() inside the handlers that need them instead.
import { db } from '@/db/SlideRuleDb'
import { createDuckDbClient } from '@/utils/SrDuckDb'

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

/** Check area against per-API thresholds, return a status string for Claude. */
function checkAreaThresholds(areaKm2: number): {
  status: 'ok' | 'warning' | 'error'
  message: string
} {
  const store = useReqParamsStore()
  const api = store.getCurAPIObj()
  if (!api) {
    return { status: 'ok', message: '' }
  }
  const thresholds = useAreaThresholdsStore()
  const errorLimit = thresholds.getAreaErrorThreshold(api)
  const warnLimit = thresholds.getAreaWarningThreshold(api)

  if (areaKm2 > errorLimit) {
    return {
      status: 'error',
      message: `Area ${areaKm2.toFixed(1)} km² exceeds the ${errorLimit} km² limit for ${api}. The request will be rejected. Choose a smaller region or switch to a different API.`
    }
  }
  if (areaKm2 > warnLimit) {
    return {
      status: 'warning',
      message: `Area ${areaKm2.toFixed(1)} km² is large for ${api} (warning threshold: ${warnLimit} km², error threshold: ${errorLimit} km²). The request may be slow or fail.`
    }
  }
  return { status: 'ok', message: '' }
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

async function handleSetRegion(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const bboxArg = args.bbox as
    | { min_lat: number; max_lat: number; min_lon: number; max_lon: number }
    | undefined
  const geojsonArg = args.geojson as { type: string; coordinates: unknown } | undefined

  if (!bboxArg && !geojsonArg) {
    return err('Provide either "bbox" (bounding box) or "geojson" (GeoJSON geometry).')
  }
  if (bboxArg && geojsonArg) {
    return err('Provide either "bbox" or "geojson", not both.')
  }

  try {
    let region: import('@/types/SrTypes').SrRegion | undefined

    if (bboxArg) {
      const { min_lat, max_lat, min_lon, max_lon } = bboxArg
      if (
        typeof min_lat !== 'number' ||
        typeof max_lat !== 'number' ||
        typeof min_lon !== 'number' ||
        typeof max_lon !== 'number'
      ) {
        return err('bbox requires numeric min_lat, max_lat, min_lon, max_lon.')
      }
      region = regionFromBounds(min_lat, max_lat, min_lon, max_lon, { close: true })
      if (!region) {
        return err('Could not create region from the provided bounding box.')
      }
      store.setPolygonSource('box')
    } else if (geojsonArg) {
      if (geojsonArg.type !== 'Polygon' && geojsonArg.type !== 'MultiPolygon') {
        return err(
          `Unsupported geometry type "${geojsonArg.type}". Must be "Polygon" or "MultiPolygon".`
        )
      }
      region = extractSrRegionFromGeometry(geojsonArg)
      store.setPolygonSource('upload')
    }

    if (!region || region.length === 0) {
      return err('Failed to create a valid region from the provided input.')
    }

    store.setPoly(region)
    const hull = convexHull(region)
    store.setConvexHull(hull)
    const areaKm2 = calculatePolygonArea(hull.length > 0 ? hull : region)
    store.setAreaOfConvexHull(areaKm2)

    const numVertices = region.length
    let msg = `Region set with ${numVertices} vertices. Area: ${areaKm2.toFixed(1)} km².`

    const areaCheck = checkAreaThresholds(areaKm2)
    if (areaCheck.status === 'error') {
      msg += ` WARNING: ${areaCheck.message}`
    } else if (areaCheck.status === 'warning') {
      msg += ` Note: ${areaCheck.message}`
    }

    return ok(msg)
  } catch (e) {
    return err(`Failed to set region: ${e instanceof Error ? e.message : String(e)}`)
  }
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
    areaCheck:
      store.poly && store.poly.length > 0 ? checkAreaThresholds(store.areaOfConvexHull) : null,
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

// ── Request Lifecycle Handlers ───────────────────────────────────

async function handleSubmitRequest(): Promise<ToolResult> {
  const serverStateStore = useServerStateStore()

  if (serverStateStore.isFetching) {
    return err('A request is already running. Wait for it to complete or cancel it first.')
  }

  const requestsStore = useRequestsStore()
  await requestsStore.fetchReqs()
  const beforeMaxId = requestsStore.reqs.reduce((max, r) => Math.max(max, r.req_id ?? 0), 0)

  try {
    const { processRunSlideRuleClicked } = await import('@/utils/workerDomUtils')
    await processRunSlideRuleClicked()
  } catch (e) {
    return err(`Submit failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  await requestsStore.fetchReqs()
  const newReq = requestsStore.reqs.find((r) => (r.req_id ?? 0) > beforeMaxId)

  if (newReq && newReq.req_id) {
    return ok(
      JSON.stringify(
        {
          req_id: newReq.req_id,
          status: newReq.status ?? 'submitted',
          message: `Request ${newReq.req_id} submitted. Use get_request_status to poll for completion.`
        },
        null,
        2
      )
    )
  }

  return err(
    'Request was not created. Check that parameters are configured correctly (mission, API, region).'
  )
}

async function handleGetRequestStatus(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const request = await db.getRequest(reqId)
  if (!request) {
    return err(`No request found with req_id ${reqId}.`)
  }

  const serverStateStore = useServerStateStore()

  let currentView: { name: unknown; path: string } | null = null
  try {
    const { default: router } = await import('@/router')
    const route = router.currentRoute.value
    currentView = { name: route.name, path: route.path }
  } catch {
    // Router not available; omit current_view
  }

  const statusInfo = {
    req_id: reqId,
    status: request.status ?? 'unknown',
    func: request.func ?? '',
    elapsed_time: request.elapsed_time ?? '',
    cnt: request.cnt != null ? Number(request.cnt) : null,
    num_bytes: request.num_bytes != null ? Number(request.num_bytes) : null,
    num_gran: request.num_gran != null ? Number(request.num_gran) : null,
    file: request.file ?? null,
    status_details: request.status_details ?? null,
    description: request.description ?? null,
    is_currently_fetching: serverStateStore.isFetching,
    current_view: currentView
  }

  return ok(JSON.stringify(statusInfo, null, 2))
}

async function handleCancelRequest(): Promise<ToolResult> {
  const serverStateStore = useServerStateStore()

  if (!serverStateStore.isFetching) {
    return err('No request is currently running.')
  }

  const { processAbortClicked } = await import('@/utils/workerDomUtils')
  processAbortClicked()
  return ok('Cancel signal sent. The running request will be aborted.')
}

async function handleListRequests(): Promise<ToolResult> {
  const requestsStore = useRequestsStore()
  await requestsStore.fetchReqs()
  const reqs = requestsStore.reqs

  if (reqs.length === 0) {
    return ok('No requests found.')
  }

  const summary = reqs.map((req) => ({
    req_id: req.req_id,
    status: req.status ?? 'unknown',
    func: req.func ?? '',
    elapsed_time: req.elapsed_time ?? '',
    cnt: req.cnt != null ? Number(req.cnt) : null,
    num_bytes: req.num_bytes != null ? Number(req.num_bytes) : null,
    description: req.description ?? ''
  }))

  return ok(JSON.stringify(summary, null, 2))
}

async function handleDeleteRequest(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const request = await db.getRequest(reqId)
  if (!request) {
    return err(`No request found with req_id ${reqId}.`)
  }

  return new Promise((resolve) => {
    const confirmService = app.config.globalProperties.$confirm

    if (!confirmService) {
      logger.error('ConfirmationService not available')
      resolve(err('ConfirmationService not available in the browser.'))
      return
    }

    confirmService.require({
      group: 'mcp',
      message: `Claude is requesting to delete request ${reqId} (${request.func ?? 'unknown'}) and all its data. Allow this?`,
      header: 'MCP: Delete Request',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Deny',
      acceptLabel: 'Allow',
      rejectClass: 'p-button-secondary',
      acceptClass: 'p-button-danger',
      accept: async () => {
        const requestsStore = useRequestsStore()
        const deleted = await requestsStore.deleteReq(reqId)
        if (deleted) {
          logger.info('Request deleted via MCP', { reqId })
          resolve(ok(`Request ${reqId} and its data have been deleted.`))
        } else {
          resolve(err(`Failed to fully delete request ${reqId}. Some data may remain.`))
        }
      },
      reject: () => {
        logger.info('User denied MCP delete_request', { reqId })
        resolve(err('User denied the delete operation.'))
      }
    })
  })
}

// ── Data Analysis Handlers ──────────────────────────────────────

function safeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER
      ? Number(value)
      : value.toString()
  }
  return value
}

function safeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = safeBigInt(value)
  }
  return out
}

async function loadDataForReq(reqId: number): Promise<{ fileName: string } | ToolResult> {
  const fileName = await db.getFilename(reqId)
  if (!fileName) {
    return err(
      `No data file found for req_id ${reqId}. The request may not have completed successfully.`
    )
  }

  try {
    const { duckDbLoadOpfsParquetFile } = await import('@/utils/SrDuckDbUtils')
    await duckDbLoadOpfsParquetFile(fileName)
  } catch (e) {
    return err(
      `Failed to load data for req_id ${reqId}: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return { fileName }
}

function isToolResult(v: unknown): v is ToolResult {
  return typeof v === 'object' && v !== null && 'content' in v
}

async function handleRunSql(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  const sql = args.sql as string
  const maxRows = Math.min(Math.max((args.max_rows as number) || 100, 1), 10000)

  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }
  if (!sql || sql.trim() === '') {
    return err('SQL query cannot be empty.')
  }

  const loaded = await loadDataForReq(reqId)
  if (isToolResult(loaded)) return loaded

  const duckDbClient = await createDuckDbClient()
  const timeoutMs = 30000

  try {
    const queryPromise = (async () => {
      const result = await duckDbClient.query(sql)
      const rows: Record<string, unknown>[] = []
      let truncated = false

      for await (const chunk of result.readRows()) {
        for (const row of chunk) {
          if (rows.length >= maxRows) {
            truncated = true
            break
          }
          rows.push(safeRow(row as Record<string, unknown>))
        }
        if (truncated) break
      }

      return {
        columns: result.schema.map((col: { name: string; type: string; databaseType: string }) => ({
          name: col.name,
          type: col.databaseType
        })),
        rows,
        row_count: rows.length,
        truncated
      }
    })()

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timed out after 30 seconds')), timeoutMs)
    )

    const output = await Promise.race([queryPromise, timeoutPromise])
    return ok(JSON.stringify(output, null, 2))
  } catch (e) {
    return err(`SQL error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleDescribeData(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const request = await db.getRequest(reqId)
  if (!request) {
    return err(`No request found with req_id ${reqId}.`)
  }

  const loaded = await loadDataForReq(reqId)
  if (isToolResult(loaded)) return loaded
  const { fileName } = loaded

  const duckDbClient = await createDuckDbClient()
  const colTypes = await duckDbClient.queryColumnTypes(fileName)
  const totalRows = await duckDbClient.getTotalRowCount(`SELECT * FROM '${fileName}'`)

  const description = {
    req_id: reqId,
    table_name: fileName,
    func: request.func ?? '',
    status: request.status ?? '',
    columns: colTypes,
    total_rows: typeof totalRows === 'bigint' ? Number(totalRows) : totalRows,
    usage_hint: `Use run_sql with: SELECT * FROM '${fileName}' LIMIT 10`
  }

  return ok(JSON.stringify(description, null, 2))
}

async function handleGetElevationStats(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const loaded = await loadDataForReq(reqId)
  if (isToolResult(loaded)) return loaded

  const { readOrCacheSummary, getAllColumnMinMax } = await import('@/utils/SrDuckDbUtils')
  const summary = await readOrCacheSummary(reqId)
  const columnStats = await getAllColumnMinMax(reqId)

  // Convert BigInt values in column stats
  const safeColumnStats: Record<string, Record<string, unknown>> = {}
  for (const [col, stats] of Object.entries(
    columnStats as Record<string, Record<string, unknown>>
  )) {
    safeColumnStats[col] = {}
    for (const [key, value] of Object.entries(stats)) {
      safeColumnStats[col][key] = safeBigInt(value)
    }
  }

  const result = {
    req_id: reqId,
    summary: summary
      ? {
          num_points: summary.numPoints,
          lat_extent: summary.extLatLon,
          height_extent: summary.extHMean
        }
      : null,
    column_statistics: safeColumnStats
  }

  return ok(JSON.stringify(result, null, 2))
}

async function handleGetSampleData(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  const numRows = Math.min(Math.max((args.num_rows as number) || 20, 1), 500)

  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const loaded = await loadDataForReq(reqId)
  if (isToolResult(loaded)) return loaded
  const { fileName } = loaded

  const duckDbClient = await createDuckDbClient()
  const baseQuery = `SELECT * FROM '${fileName}'`
  const totalRows = await duckDbClient.getTotalRowCount(baseQuery)
  const total = typeof totalRows === 'bigint' ? Number(totalRows) : totalRows

  let sampledQuery: string
  if (total <= numRows) {
    sampledQuery = baseQuery
  } else {
    const samplePercent = Math.min((numRows / total) * 150, 100)
    sampledQuery = `${baseQuery} USING SAMPLE ${samplePercent}% (bernoulli)`
  }

  const finalQuery = `${sampledQuery} LIMIT ${numRows}`
  const result = await duckDbClient.query(finalQuery)
  const rows: Record<string, unknown>[] = []

  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      rows.push(safeRow(row as Record<string, unknown>))
    }
  }

  const output = {
    req_id: reqId,
    table_name: fileName,
    total_rows: total,
    sample_rows: rows.length,
    columns: result.schema.map((col: { name: string; type: string }) => ({
      name: col.name,
      type: col.type
    })),
    rows
  }

  return ok(JSON.stringify(output, null, 2))
}

async function handleExportData(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  const customSql = args.sql as string | undefined
  const customFilename = args.filename as string | undefined

  if (!Number.isInteger(reqId) || reqId <= 0) {
    return err(`Invalid req_id: ${reqId}. Must be a positive integer.`)
  }

  const loaded = await loadDataForReq(reqId)
  if (isToolResult(loaded)) return loaded
  const { fileName } = loaded

  const sql = customSql || `SELECT * FROM '${fileName}'`
  const outputName = customFilename || `export_${reqId}.parquet`

  const duckDbClient = await createDuckDbClient()

  try {
    await duckDbClient.copyQueryToParquet(sql, outputName)
    const buffer = await duckDbClient.copyFileToBuffer(outputName)

    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = outputName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    await duckDbClient.dropVirtualFile(outputName)

    const sizeKB = (buffer.byteLength / 1024).toFixed(1)
    return ok(`Exported ${outputName} (${sizeKB} KB). Download triggered in the browser.`)
  } catch (e) {
    return err(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Documentation Tool Handlers ──────────────────────────────────

async function handleSearchDocs(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string
  const maxResults = Math.min(Math.max((args.max_results as number) || 10, 1), 50)

  if (!query || query.trim() === '') {
    return err('Search query cannot be empty.')
  }

  const { searchDocs, ensureInitialized } = await import('./docSearchEngine')
  await ensureInitialized()

  const results = await searchDocs(query, maxResults)
  if (results.length === 0) {
    return ok(
      `No results found for "${query}". Try different keywords or use fetch_docs to index more documentation.`
    )
  }

  return ok(JSON.stringify({ query, results_count: results.length, results }, null, 2))
}

async function handleFetchDocs(args: Record<string, unknown>): Promise<ToolResult> {
  const url = args.url as string

  if (!url) {
    return err('URL is required.')
  }
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (host !== 'slideruleearth.io' && !host.endsWith('.slideruleearth.io')) {
      return err('URL must be under slideruleearth.io domain.')
    }
    if (parsed.protocol !== 'https:') {
      return err('URL must use HTTPS.')
    }
  } catch {
    return err('Invalid URL.')
  }

  const { fetchAndIndexUrl, ensureInitialized } = await import('./docSearchEngine')
  await ensureInitialized()

  try {
    const result = await fetchAndIndexUrl(url)
    return ok(
      JSON.stringify(
        {
          url,
          chunks_indexed: result.chunkCount,
          sections: result.sections,
          message: `Indexed ${result.chunkCount} chunks from ${url}. Content is now searchable via search_docs.`
        },
        null,
        2
      )
    )
  } catch (e) {
    return err(`Failed to fetch and index ${url}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleGetParamHelp(args: Record<string, unknown>): Promise<ToolResult> {
  const paramName = args.param_name as string

  const { getParamHelp, ensureInitialized } = await import('./docSearchEngine')
  await ensureInitialized()

  const help = await getParamHelp(paramName)
  if (!help) {
    return ok(
      `No help found for parameter "${paramName}". Try search_docs to find related documentation.`
    )
  }

  return ok(JSON.stringify(help, null, 2))
}

async function handleListDocSections(): Promise<ToolResult> {
  const { listDocSections, ensureInitialized } = await import('./docSearchEngine')
  await ensureInitialized()

  const sections = await listDocSections()
  return ok(JSON.stringify({ total_sections: sections.length, sections }, null, 2))
}

// ── UI Tool Handlers ─────────────────────────────────────────────

async function handleStartTour(args: Record<string, unknown>): Promise<ToolResult> {
  const tourType = args.type as 'quick' | 'long'
  if (tourType !== 'quick' && tourType !== 'long') {
    return err(`Invalid tour type "${tourType}". Must be "quick" or "long".`)
  }

  const { useTourStore } = await import('@/stores/tourStore')
  const tourStore = useTourStore()
  tourStore.requestTour(tourType)

  return ok(
    `Started the ${tourType} tour in the browser. The user will see an interactive guided walkthrough of the app.`
  )
}

async function handleNavigate(args: Record<string, unknown>): Promise<ToolResult> {
  const view = args.view as string
  const reqId = args.req_id as number | undefined

  const { default: router } = await import('@/router')

  try {
    if (view === 'analyze') {
      if (reqId == null || !Number.isInteger(reqId) || reqId <= 0) {
        return err(
          'req_id is required when navigating to "analyze". Provide a valid positive integer.'
        )
      }
      await router.push(`/analyze/${reqId}`)
    } else if (view === 'request' && reqId != null) {
      await router.push(`/request/${reqId}`)
    } else {
      await router.push({ name: view })
    }

    const currentRoute = router.currentRoute.value
    return ok(
      JSON.stringify(
        {
          navigated: true,
          route: {
            name: currentRoute.name,
            path: currentRoute.path,
            params: currentRoute.params
          }
        },
        null,
        2
      )
    )
  } catch (e) {
    return err(`Navigation failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleGetCurrentView(): Promise<ToolResult> {
  const { default: router } = await import('@/router')
  const currentRoute = router.currentRoute.value

  const filteredNames = new Set(['NotFound', 'github-callback', 'request-with-params'])
  const availableRoutes = router
    .getRoutes()
    .filter((r) => r.name && !filteredNames.has(r.name as string))
    .map((r) => {
      const result: Record<string, unknown> = { name: r.name, path: r.path }
      const paramMatch = r.path.match(/:(\w+)/)
      if (paramMatch) {
        result.requiresParam = paramMatch[1]
      }
      return result
    })

  return ok(
    JSON.stringify(
      {
        route: {
          name: currentRoute.name ?? null,
          path: currentRoute.path,
          params: currentRoute.params
        },
        availableRoutes
      },
      null,
      2
    )
  )
}

// ── Map Tool Handlers ────────────────────────────────────────────

async function handleZoomToBbox(args: Record<string, unknown>): Promise<ToolResult> {
  const { min_lat, max_lat, min_lon, max_lon } = args as {
    min_lat: number
    max_lat: number
    min_lon: number
    max_lon: number
  }

  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  const map = mapStore.getMap()
  if (!map) {
    return err('Map is not available. The map view may not be initialized yet.')
  }

  const { transformExtent } = await import('ol/proj')
  const view = map.getView()
  const projection = view.getProjection().getCode()
  const extent = transformExtent([min_lon, min_lat, max_lon, max_lat], 'EPSG:4326', projection)
  view.fit(extent, { duration: 500, padding: [50, 50, 50, 50] })

  return ok(`Map zoomed to bounding box: [${min_lat}, ${min_lon}] – [${max_lat}, ${max_lon}].`)
}

async function handleZoomToPoint(args: Record<string, unknown>): Promise<ToolResult> {
  const lat = args.lat as number
  const lon = args.lon as number
  const zoom = (args.zoom as number) ?? 10

  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  const map = mapStore.getMap()
  if (!map) {
    return err('Map is not available. The map view may not be initialized yet.')
  }

  const { fromLonLat } = await import('ol/proj')
  const view = map.getView()
  const projection = view.getProjection().getCode()
  const center = fromLonLat([lon, lat], projection)
  view.animate({ center, zoom, duration: 500 })

  return ok(`Map centered on [${lat}, ${lon}] at zoom level ${zoom}.`)
}

async function handleSetBaseLayer(args: Record<string, unknown>): Promise<ToolResult> {
  const layer = args.layer as string
  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  mapStore.setSelectedBaseLayer(layer)
  return ok(`Base layer set to "${layer}".`)
}

async function handleSetMapView(args: Record<string, unknown>): Promise<ToolResult> {
  const view = args.view as string
  const validViews = ['Global Mercator', 'North Alaska', 'North Sea Ice', 'South']
  if (!validViews.includes(view)) {
    return err(`Invalid view "${view}". Must be one of: ${validViews.join(', ')}.`)
  }
  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  mapStore.setSrView(view)
  return ok(`Map view/projection set to "${view}".`)
}

async function handleToggleGraticule(args: Record<string, unknown>): Promise<ToolResult> {
  const visible = args.visible as boolean
  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  mapStore.setGraticuleState(visible)
  return ok(`Graticule ${visible ? 'shown' : 'hidden'}.`)
}

async function handleSetDrawMode(args: Record<string, unknown>): Promise<ToolResult> {
  const mode = args.mode as string
  const validModes = ['Polygon', 'Box', '']
  if (!validModes.includes(mode)) {
    return err(
      `Invalid draw mode "${mode}". Must be one of: "Polygon", "Box", or "" (empty to disable).`
    )
  }
  const { useMapStore } = await import('@/stores/mapStore')
  const mapStore = useMapStore()
  mapStore.setDrawType(mode)
  return ok(mode ? `Draw mode set to "${mode}".` : 'Draw mode disabled.')
}

// ── Visualization Tool Handlers ──────────────────────────────────

async function handleSetChartField(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  const field = args.field as string
  const reqIdStr = String(reqId)

  const { useChartStore } = await import('@/stores/chartStore')
  const chartStore = useChartStore()
  if (!chartStore.ensureState(reqIdStr)) {
    return err(`Invalid req_id: ${reqId}.`)
  }
  chartStore.setSelectedYData(reqIdStr, field)
  return ok(`Chart Y-axis field set to "${field}" for request ${reqId}.`)
}

async function handleSetXAxis(args: Record<string, unknown>): Promise<ToolResult> {
  const reqId = args.req_id as number
  const field = args.field as string
  const reqIdStr = String(reqId)

  const { useChartStore } = await import('@/stores/chartStore')
  const chartStore = useChartStore()
  if (!chartStore.ensureState(reqIdStr)) {
    return err(`Invalid req_id: ${reqId}.`)
  }
  chartStore.stateByReqId[reqIdStr].xDataForChart = field
  return ok(`Chart X-axis field set to "${field}" for request ${reqId}.`)
}

async function handleSetColorMap(args: Record<string, unknown>): Promise<ToolResult> {
  const palette = args.palette as string
  const { srColorMapNames } = await import('@/utils/colorUtils')

  if (!srColorMapNames.includes(palette)) {
    return err(`Invalid palette "${palette}". Valid options: ${srColorMapNames.join(', ')}.`)
  }

  // Apply to most recent request's gradient store
  const requestsStore = useRequestsStore()
  await requestsStore.fetchReqs()
  const reqs = requestsStore.reqs
  if (reqs.length === 0) {
    return err('No requests found. Submit a request first so the color map has data to apply to.')
  }
  const latestReq = reqs[0]
  const reqIdStr = String(latestReq.req_id)

  const { useGradientColorMapStore } = await import('@/stores/gradientColorMapStore')
  const gradientStore = useGradientColorMapStore(reqIdStr)
  gradientStore.setSelectedGradientColorMapName(palette)
  return ok(`Color map set to "${palette}" for request ${latestReq.req_id}.`)
}

async function handleSet3dConfig(args: Record<string, unknown>): Promise<ToolResult> {
  const { useDeck3DConfigStore } = await import('@/stores/deck3DConfigStore')
  const deck3DStore = useDeck3DConfigStore()
  const details: string[] = []

  if (args.vertical_exaggeration !== undefined) {
    deck3DStore.verticalExaggeration = args.vertical_exaggeration as number
    details.push(`vertical_exaggeration=${args.vertical_exaggeration}`)
  }
  if (args.point_size !== undefined) {
    deck3DStore.pointSize = args.point_size as number
    details.push(`point_size=${args.point_size}`)
  }
  if (args.fov !== undefined) {
    deck3DStore.fovy = args.fov as number
    details.push(`fov=${args.fov}`)
  }
  if (args.show_axes !== undefined) {
    deck3DStore.showAxes = args.show_axes as boolean
    details.push(`show_axes=${args.show_axes}`)
  }

  if (details.length === 0) {
    return err('At least one 3D config parameter must be provided.')
  }

  return ok(`3D config updated: ${details.join(', ')}.`)
}

async function handleSetPlotOptions(args: Record<string, unknown>): Promise<ToolResult> {
  const details: string[] = []

  if (args.req_id !== undefined && args.color_field !== undefined) {
    const reqIdStr = String(args.req_id as number)
    const { useChartStore } = await import('@/stores/chartStore')
    const chartStore = useChartStore()
    if (!chartStore.ensureState(reqIdStr)) {
      return err(`Invalid req_id: ${args.req_id}.`)
    }
    chartStore.setSelectedColorEncodeData(reqIdStr, args.color_field as string)
    details.push(`color_field="${args.color_field}" for req ${args.req_id}`)
  }

  if (args.show_tooltip !== undefined) {
    const { useGlobalChartStore } = await import('@/stores/globalChartStore')
    const globalChartStore = useGlobalChartStore()
    globalChartStore.showPlotTooltip = args.show_tooltip as boolean
    details.push(`show_tooltip=${args.show_tooltip}`)
  }

  if (details.length === 0) {
    return err('At least one plot option must be provided.')
  }

  return ok(`Plot options updated: ${details.join(', ')}.`)
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
  set_region: handleSetRegion,
  set_beams: handleSetBeams,
  set_surface_fit: handleSetSurfaceFit,
  set_photon_params: handleSetPhotonParams,
  set_yapc: handleSetYapc,
  set_output_config: handleSetOutputConfig,
  get_current_params: handleGetCurrentParams,
  reset_params: handleResetParams,
  submit_request: handleSubmitRequest,
  get_request_status: handleGetRequestStatus,
  cancel_request: handleCancelRequest,
  list_requests: handleListRequests,
  delete_request: handleDeleteRequest,
  run_sql: handleRunSql,
  describe_data: handleDescribeData,
  get_elevation_stats: handleGetElevationStats,
  get_sample_data: handleGetSampleData,
  export_data: handleExportData,
  search_docs: handleSearchDocs,
  fetch_docs: handleFetchDocs,
  get_param_help: handleGetParamHelp,
  list_doc_sections: handleListDocSections,
  start_tour: handleStartTour,
  zoom_to_bbox: handleZoomToBbox,
  zoom_to_point: handleZoomToPoint,
  set_base_layer: handleSetBaseLayer,
  set_map_view: handleSetMapView,
  toggle_graticule: handleToggleGraticule,
  set_draw_mode: handleSetDrawMode,
  set_chart_field: handleSetChartField,
  set_x_axis: handleSetXAxis,
  set_color_map: handleSetColorMap,
  set_3d_config: handleSet3dConfig,
  set_plot_options: handleSetPlotOptions,
  navigate: handleNavigate,
  get_current_view: handleGetCurrentView
}

for (const def of toolDefinitions) {
  const handler = handlers[def.name]
  if (handler) {
    registerTool(def, handler)
  }
}
