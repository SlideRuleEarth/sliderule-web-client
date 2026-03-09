import { createLogger } from '@/utils/logger'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRequestsStore } from '@/stores/requestsStore'
import { useServerStateStore } from '@/stores/serverStateStore'
import { useMapStore } from '@/stores/mapStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
import { iceSat2APIsItems, gediAPIsItems } from '@/types/SrStaticOptions'
import { db } from '@/db/SlideRuleDb'
import { createDuckDbClient } from '@/utils/SrDuckDb'

const logger = createLogger('ResourceResolver')

// ── Types ────────────────────────────────────────────────────────

interface ResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
}

interface ResourceTemplateDefinition {
  uriTemplate: string
  name: string
  description: string
  mimeType: string
}

interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>
}

// ── Static resource catalog ──────────────────────────────────────

const RESOURCES: ResourceDefinition[] = [
  {
    uri: 'sliderule://params/current',
    name: 'Current Parameters',
    description: 'Full current parameter state from reqParamsStore',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://requests/history',
    name: 'Request History',
    description: 'All request records with status, timing, and point counts',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://map/viewport',
    name: 'Map Viewport',
    description: 'Current map center, zoom, projection, and visible extent',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://catalog/products',
    name: 'Available Products',
    description: 'Available missions and their API endpoints',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://auth/status',
    name: 'Auth Status',
    description: 'Current authentication state: username, org membership',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://docs/index',
    name: 'Documentation Index',
    description: 'All indexed doc sections with titles and chunk counts',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://docs/tooltips',
    name: 'All Tooltips',
    description: 'All in-app tooltip text organized by parameter',
    mimeType: 'application/json'
  },
  {
    uri: 'sliderule://app/current-view',
    name: 'Current View',
    description: 'Current Vue Router view name, path, params, and list of available routes',
    mimeType: 'application/json'
  }
]

const RESOURCE_TEMPLATES: ResourceTemplateDefinition[] = [
  {
    uriTemplate: 'sliderule://requests/{id}/summary',
    name: 'Request Summary',
    description: 'Status, timing, row count for a specific request',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://data/{id}/schema',
    name: 'Data Schema',
    description: 'Column names and types for a result set',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://data/{id}/sample',
    name: 'Data Sample',
    description: 'First 20 rows of a result set',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://catalog/fields/{api}',
    name: 'API Fields',
    description: 'Available data fields for a specific API',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://docs/section/{section}',
    name: 'Doc Section',
    description: 'All chunks for a documentation section',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://docs/param/{name}',
    name: 'Parameter Help',
    description: 'Parameter help: tooltip, defaults, valid values, doc URL',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'sliderule://docs/defaults/{mission}',
    name: 'Server Defaults',
    description: 'Server defaults for a mission (icesat2, gedi, core)',
    mimeType: 'application/json'
  }
]

// ── Public API ───────────────────────────────────────────────────

export function listResources(): ResourceDefinition[] {
  return RESOURCES
}

export function listResourceTemplates(): ResourceTemplateDefinition[] {
  return RESOURCE_TEMPLATES
}

export async function readResource(uri: string): Promise<ResourceReadResult> {
  logger.debug('Reading resource', uri)

  // Static resources
  if (uri === 'sliderule://params/current') return resolveParamsCurrent(uri)
  if (uri === 'sliderule://requests/history') return await resolveRequestsHistory(uri)
  if (uri === 'sliderule://map/viewport') return resolveMapViewport(uri)
  if (uri === 'sliderule://catalog/products') return resolveCatalogProducts(uri)
  if (uri === 'sliderule://auth/status') return resolveAuthStatus(uri)
  if (uri === 'sliderule://docs/index') return await resolveDocsIndex(uri)
  if (uri === 'sliderule://docs/tooltips') return resolveDocsTooltips(uri)
  if (uri === 'sliderule://app/current-view') return await resolveAppCurrentView(uri)

  // Templated resources
  let match: RegExpMatchArray | null

  match = uri.match(/^sliderule:\/\/requests\/(\d+)\/summary$/)
  if (match) return await resolveRequestSummary(uri, parseInt(match[1]))

  match = uri.match(/^sliderule:\/\/data\/(\d+)\/schema$/)
  if (match) return await resolveDataSchema(uri, parseInt(match[1]))

  match = uri.match(/^sliderule:\/\/data\/(\d+)\/sample$/)
  if (match) return await resolveDataSample(uri, parseInt(match[1]))

  match = uri.match(/^sliderule:\/\/catalog\/fields\/(.+)$/)
  if (match) return resolveCatalogFields(uri, match[1])

  match = uri.match(/^sliderule:\/\/docs\/section\/(.+)$/)
  if (match) return await resolveDocsSection(uri, match[1])

  match = uri.match(/^sliderule:\/\/docs\/param\/(.+)$/)
  if (match) return await resolveDocsParam(uri, match[1])

  match = uri.match(/^sliderule:\/\/docs\/defaults\/(.+)$/)
  if (match) return resolveDocsDefaults(uri, match[1])

  throw new Error(`Unknown resource URI: ${uri}`)
}

// ── Helpers ──────────────────────────────────────────────────────

function textResult(uri: string, data: unknown): ResourceReadResult {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2)
      }
    ]
  }
}

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

// ── App Resource Resolvers ───────────────────────────────────────

function resolveParamsCurrent(uri: string): ResourceReadResult {
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
  return textResult(uri, params)
}

async function resolveRequestsHistory(uri: string): Promise<ResourceReadResult> {
  const requestsStore = useRequestsStore()
  await requestsStore.fetchReqs()
  const reqs = requestsStore.reqs

  const summary = reqs.map((req) => ({
    req_id: req.req_id,
    status: req.status ?? 'unknown',
    func: req.func ?? '',
    elapsed_time: req.elapsed_time ?? '',
    cnt: req.cnt != null ? Number(req.cnt) : null,
    num_bytes: req.num_bytes != null ? Number(req.num_bytes) : null,
    description: req.description ?? ''
  }))

  return textResult(uri, summary)
}

async function resolveRequestSummary(uri: string, reqId: number): Promise<ResourceReadResult> {
  const request = await db.getRequest(reqId)
  if (!request) {
    return textResult(uri, { error: `No request found with req_id ${reqId}` })
  }

  const serverStateStore = useServerStateStore()
  const data = {
    req_id: reqId,
    status: request.status ?? 'unknown',
    func: request.func ?? '',
    elapsed_time: request.elapsed_time ?? '',
    cnt: request.cnt != null ? Number(request.cnt) : null,
    num_bytes: request.num_bytes != null ? Number(request.num_bytes) : null,
    num_gran: request.num_gran != null ? Number(request.num_gran) : null,
    file: request.file ?? null,
    description: request.description ?? null,
    is_currently_fetching: serverStateStore.isFetching
  }
  return textResult(uri, data)
}

async function resolveDataSchema(uri: string, reqId: number): Promise<ResourceReadResult> {
  const fileName = await db.getFilename(reqId)
  if (!fileName) {
    return textResult(uri, { error: `No data file found for req_id ${reqId}` })
  }

  try {
    const { duckDbLoadOpfsParquetFile } = await import('@/utils/SrDuckDbUtils')
    await duckDbLoadOpfsParquetFile(fileName)
  } catch (e) {
    return textResult(uri, {
      error: `Failed to load data: ${e instanceof Error ? e.message : String(e)}`
    })
  }

  const duckDbClient = await createDuckDbClient()
  const colTypes = await duckDbClient.queryColumnTypes(fileName)
  const totalRows = await duckDbClient.getTotalRowCount(`SELECT * FROM '${fileName}'`)

  return textResult(uri, {
    req_id: reqId,
    table_name: fileName,
    columns: colTypes,
    total_rows: typeof totalRows === 'bigint' ? Number(totalRows) : totalRows
  })
}

async function resolveDataSample(uri: string, reqId: number): Promise<ResourceReadResult> {
  const fileName = await db.getFilename(reqId)
  if (!fileName) {
    return textResult(uri, { error: `No data file found for req_id ${reqId}` })
  }

  try {
    const { duckDbLoadOpfsParquetFile } = await import('@/utils/SrDuckDbUtils')
    await duckDbLoadOpfsParquetFile(fileName)
  } catch (e) {
    return textResult(uri, {
      error: `Failed to load data: ${e instanceof Error ? e.message : String(e)}`
    })
  }

  const duckDbClient = await createDuckDbClient()
  const result = await duckDbClient.query(`SELECT * FROM '${fileName}' LIMIT 20`)
  const rows: Record<string, unknown>[] = []

  for await (const chunk of result.readRows()) {
    for (const row of chunk) {
      rows.push(safeRow(row as Record<string, unknown>))
    }
  }

  return textResult(uri, {
    req_id: reqId,
    table_name: fileName,
    sample_rows: rows.length,
    columns: result.schema.map((col: { name: string; type: string }) => ({
      name: col.name,
      type: col.type
    })),
    rows
  })
}

function resolveMapViewport(uri: string): ResourceReadResult {
  const mapStore = useMapStore()
  const map = mapStore.getMap()
  const view = map?.getView()
  const data = {
    center: view?.getCenter() ?? null,
    zoom: view?.getZoom() ?? null,
    projection: view?.getProjection()?.getCode() ?? null,
    selectedView: mapStore.selectedView,
    selectedBaseLayer: mapStore.selectedBaseLayer
  }
  return textResult(uri, data)
}

function resolveCatalogProducts(uri: string): ResourceReadResult {
  return textResult(uri, {
    missions: ['ICESat-2', 'GEDI'],
    apis: {
      'ICESat-2': iceSat2APIsItems,
      GEDI: gediAPIsItems
    }
  })
}

function resolveCatalogFields(uri: string, api: string): ResourceReadResult {
  // Height field mapping (mirrors getHFieldNameForAPIStr in fieldNameStore.ts)
  const heightFields: Record<string, string> = {
    atl06: 'h_mean',
    atl06p: 'h_mean',
    atl06x: 'h_li',
    atl06s: 'h_li',
    atl06sp: 'h_li',
    atl03vp: 'segment_ph_cnt',
    'atl03x-surface': 'h_mean',
    'atl03x-phoreal': 'h_mean_canopy',
    atl03x: 'height',
    atl08: 'h_mean_canopy',
    atl08p: 'h_mean_canopy',
    atl08x: 'h_canopy',
    atl24x: 'ortho_h',
    atl13x: 'ht_ortho',
    gedi02ap: 'elevation_lm',
    gedi04ap: 'elevation',
    gedi01bp: 'elevation_start'
  }

  const heightField = heightFields[api] ?? 'unknown'
  const latField = api === 'atl24x' ? 'lat_ph' : 'latitude'
  const lonField = api === 'atl24x' ? 'lon_ph' : 'longitude'
  const mission = api.startsWith('atl') ? 'ICESat-2' : api.startsWith('gedi') ? 'GEDI' : 'unknown'

  return textResult(uri, {
    api,
    mission,
    height_field: heightField,
    latitude_field: latField,
    longitude_field: lonField
  })
}

function resolveAuthStatus(uri: string): ResourceReadResult {
  const auth = useGitHubAuthStore()
  return textResult(uri, {
    authStatus: auth.authStatus,
    username: auth.username,
    isOrgMember: auth.isOrgMember
  })
}

async function resolveAppCurrentView(uri: string): Promise<ResourceReadResult> {
  const { default: router } = await import('@/router')
  const currentRoute = router.currentRoute.value

  const filteredNames = new Set(['NotFound', 'github-callback', 'request-with-params'])
  const availableRoutes = router
    .getRoutes()
    .filter((r) => r.name && !filteredNames.has(r.name as string))
    .map((r) => {
      const result: Record<string, unknown> = {
        name: r.name,
        path: r.path
      }
      const paramMatch = r.path.match(/:(\w+)/)
      if (paramMatch) {
        result.requiresParam = paramMatch[1]
      }
      return result
    })

  return textResult(uri, {
    route: {
      name: currentRoute.name ?? null,
      path: currentRoute.path,
      params: currentRoute.params
    },
    availableRoutes
  })
}

// ── Documentation Resource Resolvers ─────────────────────────────

async function resolveDocsIndex(uri: string): Promise<ResourceReadResult> {
  try {
    const { getDocsIndex, isInitialized } = await import('./docSearchEngine')
    if (isInitialized()) {
      const index = await getDocsIndex()
      return textResult(uri, index)
    }
  } catch {
    // Engine not yet available — fall through to bundled data
  }
  // Fallback: load bundled docs-index.json directly
  try {
    const docsIndex = await import('@/assets/docs-index.json')
    return textResult(uri, docsIndex.default?.chunks ?? [])
  } catch {
    return textResult(uri, { message: 'Documentation index not yet available' })
  }
}

async function resolveDocsTooltips(uri: string): Promise<ResourceReadResult> {
  try {
    const docsIndex = await import('@/assets/docs-index.json')
    return textResult(uri, docsIndex.default?.tooltips ?? [])
  } catch {
    return textResult(uri, { message: 'Tooltips not yet available' })
  }
}

async function resolveDocsSection(uri: string, section: string): Promise<ResourceReadResult> {
  try {
    const { getDocSection, isInitialized } = await import('./docSearchEngine')
    if (isInitialized()) {
      const chunks = await getDocSection(section)
      return textResult(uri, chunks)
    }
  } catch {
    // Engine not ready
  }
  return textResult(uri, {
    message: `Doc section "${section}" not available. Engine not initialized.`
  })
}

async function resolveDocsParam(uri: string, name: string): Promise<ResourceReadResult> {
  try {
    const { getParamHelp, isInitialized } = await import('./docSearchEngine')
    if (isInitialized()) {
      const help = await getParamHelp(name)
      return textResult(uri, help ?? { message: `No help found for parameter "${name}"` })
    }
  } catch {
    // Engine not ready
  }
  return textResult(uri, { message: `Parameter help not available. Engine not initialized.` })
}

function resolveDocsDefaults(uri: string, mission: string): ResourceReadResult {
  const store = useSlideruleDefaults()
  if (!store.fetched) {
    return textResult(uri, { message: 'Defaults not yet loaded' })
  }

  const defaults = store.getDefaults()
  const key = mission.toLowerCase().replace('icesat-2', 'icesat2')

  if (defaults && key in defaults) {
    return textResult(uri, (defaults as Record<string, unknown>)[key])
  }
  return textResult(uri, {
    error: `Unknown mission: ${mission}. Valid keys: icesat2, gedi, core, bathy, swot, cre`
  })
}
