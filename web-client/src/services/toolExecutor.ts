import { createLogger } from '@/utils/logger'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRequestsStore } from '@/stores/requestsStore'
import { useServerStateStore } from '@/stores/serverStateStore'
import { app } from '@/main'
import { toolDefinitions, type ToolDefinition } from './toolDefinitions'
import { iceSat2APIsItems, gediAPIsItems } from '@/types/SrStaticOptions'
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

async function handleSetGeneralPreset(args: Record<string, unknown>): Promise<ToolResult> {
  const label = args.preset as string
  const store = useReqParamsStore()
  const result = store.applyGeneralPreset(label)
  if (!result) {
    const valid = store.getGeneralPresetLabels().join(', ')
    return err(`Unknown preset "${label}". Valid presets: ${valid}`)
  }
  return ok(`Preset "${label}" applied. Mission, API, and parameters configured.`)
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

async function handleSetRegion(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const { convexHull, regionFromBounds, calculatePolygonArea } = await import(
    '@/composables/SrTurfUtils'
  )
  const { useMapStore } = await import('@/stores/mapStore')
  const { renderRequestPolygon, clearPolyCoords } = await import('@/utils/SrMapUtils')

  let poly: { lat: number; lon: number }[]

  if (args.bounds) {
    const b = args.bounds as { min_lat: number; max_lat: number; min_lon: number; max_lon: number }
    const region = regionFromBounds(b.min_lat, b.max_lat, b.min_lon, b.max_lon)
    if (!region)
      return err(
        'Invalid bounds. All four values (min_lat, max_lat, min_lon, max_lon) are required.'
      )
    poly = region
    store.setPolygonSource('box')
  } else if (args.coordinates) {
    const coords = args.coordinates as { lon: number; lat: number }[]
    if (coords.length < 3) return err('At least 3 coordinate points are required for a polygon.')
    poly = coords.map((c) => ({ lat: c.lat, lon: c.lon }))
    store.setPolygonSource('polygon')
  } else {
    return err('Provide either "bounds" (bounding box) or "coordinates" (polygon vertices).')
  }

  store.setPoly(poly)
  const hull = convexHull(poly)
  store.setConvexHull(hull)

  const map = useMapStore().getMap()
  if (map) {
    clearPolyCoords()
    renderRequestPolygon(map as any, poly, 'red')
  }

  const areaKm2 = calculatePolygonArea(hull)
  const areaCheck = checkAreaThresholds(areaKm2)

  let msg = `Region set with ${poly.length} vertices. Area: ${areaKm2.toFixed(1)} km².`
  if (areaCheck.status !== 'ok') {
    msg += ` ${areaCheck.message}`
  }
  return areaCheck.status === 'error' ? err(msg) : ok(msg)
}

async function handleZoomToLocation(args: Record<string, unknown>): Promise<ToolResult> {
  const lon = args.lon as number
  const lat = args.lat as number
  const zoom = (args.zoom as number) ?? 10

  if (lon < -180 || lon > 180)
    return err(`Invalid longitude: ${lon}. Must be between -180 and 180.`)
  if (lat < -90 || lat > 90) return err(`Invalid latitude: ${lat}. Must be between -90 and 90.`)

  const { useMapStore } = await import('@/stores/mapStore')
  const { useAnalysisMapStore } = await import('@/stores/analysisMapStore')
  const { fromLonLat } = await import('ol/proj')
  const { default: router } = await import('@/router')

  // Pick the right map based on the current route
  const route = router.currentRoute.value
  let map
  if (route.path.startsWith('/analyze')) {
    map = useAnalysisMapStore().map
  } else {
    map = useMapStore().getMap()
  }

  if (!map) return err('Map is not available. Make sure the browser is open with the map visible.')

  const view = map.getView()
  if (!view) return err('Map view is not available.')

  const projection = view.getProjection()
  const center = fromLonLat([lon, lat], projection)

  view.animate({ center, zoom, duration: 1000 })

  return ok(`Map zoomed to lon=${lon}, lat=${lat} at zoom level ${zoom}.`)
}

async function handleGetAreaThresholds(args: Record<string, unknown>): Promise<ToolResult> {
  const reqStore = useReqParamsStore()
  const thresholds = useAreaThresholdsStore()

  const apiName = (args.api as string) || reqStore.getCurAPIObj()
  if (!apiName) {
    return err('No API is currently selected and none was provided.')
  }

  const warning = thresholds.getAreaWarningThreshold(
    apiName as Parameters<typeof thresholds.getAreaWarningThreshold>[0]
  )
  const error = thresholds.getAreaErrorThreshold(
    apiName as Parameters<typeof thresholds.getAreaErrorThreshold>[0]
  )

  const currentArea = reqStore.poly && reqStore.poly.length > 0 ? reqStore.areaOfConvexHull : null
  const areaCheck = currentArea !== null ? checkAreaThresholds(currentArea) : null

  return ok(
    JSON.stringify(
      {
        api: apiName,
        warning_threshold_km2: warning,
        error_threshold_km2: error,
        current_region_area_km2: currentArea,
        area_status: areaCheck?.status ?? 'no_region',
        area_message: areaCheck?.message ?? 'No region set.'
      },
      null,
      2
    )
  )
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
    const store = useReqParamsStore()
    return ok(
      JSON.stringify(
        {
          req_id: newReq.req_id,
          status: newReq.status ?? 'submitted',
          message: `Request ${newReq.req_id} submitted. Use get_request_status to poll for completion.`,
          parameters: {
            mission: store.missionValue,
            api: store.getCurAPIStr(),
            url: store.urlValue,
            time_range: store.useTime ? { t0: store.t0Value, t1: store.t1Value } : null,
            region_vertices: store.poly?.length ?? 0,
            area_km2: store.areaOfConvexHull
          }
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
        sql_query: sql,
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

async function handleInitialize(args: Record<string, unknown>): Promise<ToolResult> {
  const store = useReqParamsStore()
  const presets = store.getGeneralPresetLabels()
  const serverVersion = (args._server_version as string) || 'unknown'

  return ok(
    `SlideRule Web Client — Session Initialized (MCP server v${serverVersion})

You control the SlideRule web client via MCP tools. SlideRule processes NASA ICESat-2 and GEDI satellite altimetry data in the cloud. The browser must be open for tools to work.

## Scientific Transparency

Show all SQL queries. Include units (m, km², degrees) and CRS (EPSG codes). Label data provenance: [SlideRule data], [SlideRule docs], or [Model knowledge]. Include enough detail for reproducibility.

## Workflow

1. Call get_current_params to see what's already configured
2. CONFIGURE: a region is required, if needed use set_region. If the user describes a science goal (e.g. "canopy heights", "ice sheet elevations", "bathymetry"), use set_general_preset to configure.
3. SUBMIT: submit_request → returns req_id
4. POLL: get_request_status(req_id) until "success" or "error"
5. ANALYZE: describe_data(req_id) → run_sql / get_elevation_stats

## General Presets

Use set_general_preset with one of these labels to configure mission, API, and processing parameters in one step:
${presets.map((p) => `- ${p}`).join('\n')}

## Key Rules

- Region required before submit. User can also draw in browser.
- Do not set parameters the user didn't ask for. Defaults are already good.
- run_sql uses DuckDB syntax. Table names must be quoted: SELECT * FROM 'filename.parquet'
- describe_data returns the table name. Always call it before run_sql.
- Only one request at a time. Poll after submit.
- reset_params requires user confirmation in the browser.
- For visualizations, create charts in your response from run_sql data — no map/chart control tools exist.
- For SlideRule questions, use search_docs or get_param_help before relying on training data.
- Summarize findings (elevation range, extent, point count) rather than dumping raw JSON.`
  )
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
  set_general_preset: handleSetGeneralPreset,
  set_surface_fit: handleSetSurfaceFit,
  set_photon_params: handleSetPhotonParams,
  set_yapc: handleSetYapc,
  set_region: handleSetRegion,
  zoom_to_location: handleZoomToLocation,
  get_area_thresholds: handleGetAreaThresholds,
  get_current_params: handleGetCurrentParams,
  reset_params: handleResetParams,
  submit_request: handleSubmitRequest,
  get_request_status: handleGetRequestStatus,
  list_requests: handleListRequests,
  run_sql: handleRunSql,
  describe_data: handleDescribeData,
  get_elevation_stats: handleGetElevationStats,
  search_docs: handleSearchDocs,
  fetch_docs: handleFetchDocs,
  get_param_help: handleGetParamHelp,
  initialize: handleInitialize
}

for (const def of toolDefinitions) {
  const handler = handlers[def.name]
  if (handler) {
    registerTool(def, handler)
  }
}
