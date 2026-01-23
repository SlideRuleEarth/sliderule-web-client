import { PointCloudLayer } from '@deck.gl/layers'
import { SimpleMeshLayer } from '@deck.gl/mesh-layers'
import { SphereGeometry } from '@luma.gl/engine'
import { createDuckDbClient } from '@/utils/SrDuckDb'
import { db as indexedDb } from '@/db/SlideRuleDb'
import { computeSamplingRate } from '@/utils/SrDuckDbUtils'
import { createAxesAndLabels } from '@/utils/deckAxes'
import type { Layer } from '@deck.gl/core'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { OrbitView, OrbitController } from '@deck.gl/core'
import { ref, type Ref } from 'vue'
import { Deck } from '@deck.gl/core'
import proj4 from 'proj4'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useChartStore } from '@/stores/chartStore'
import { useGlobalChartStore } from '@/stores/globalChartStore'

// import log from '@probe.gl/log';
// log.level = 1;  // 0 = silent, 1 = minimal, 2 = verbose

import { toRaw, isProxy, markRaw } from 'vue'
import { formatTime } from '@/utils/formatUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Deck3DPlotUtils')

const deck3DConfigStore = useDeck3DConfigStore()
const recTreeStore = useRecTreeStore()
const fieldStore = useFieldNameStore()
const chartStore = useChartStore()
const viewId = 'main'

let latField = ''
let lonField = ''
let heightField = ''
let timeField = ''

// Use Vue ref like main branch (which works)
const deckInstance: Ref<Deck<OrbitView[]> | null> = ref(null)
// Module-level state for caching and Deck.gl instance
let cachedRawData: any[] = []
let lastLoadedReqId: number | null = null
let verticalExaggerationInitialized = false

// Transformation cache for coordinate transformation (2D map hover -> 3D)
let transformCache: {
  dstCrs: string
  lonMin: number
  latMin: number
  metersToWorld: number
  h0: number
  zToWorld: number
} | null = null

// Cached point cloud data for hover marker positioning
let cachedPointCloudData: Array<{
  position: [number, number, number]
  lat: number
  lon: number
  elevation: number
  track?: number
  spot?: number
  cycle?: number
  rgt?: number
}> = []

// helper: pick a local metric CRS (UTM or polar)
function pickLocalMetricCRS(lat: number, lon: number): string {
  const absLat = Math.abs(lat)
  if (absLat >= 83) {
    // near poles: use polar stereographic
    return lat >= 0 ? 'EPSG:3413' : 'EPSG:3031'
  }
  const zone = Math.floor((lon + 180) / 6) + 1
  return lat >= 0
    ? `EPSG:326${String(zone).padStart(2, '0')}` // WGS84 / UTM N
    : `EPSG:327${String(zone).padStart(2, '0')}` // WGS84 / UTM S
}

/**
 * Strips Vue reactivity from Deck.gl-compatible data to prevent runtime Proxy errors.
 *
 * @param data - The data array to sanitize
 * @returns A plain array with raw objects safe to use with Deck.gl layers
 */
export function sanitizeDeckData<T extends Record<string, any>>(data: T[]): T[] {
  let sanitized: T[]

  if (isProxy(data)) {
    const raw = toRaw(data)
    sanitized = raw.map((item) => ({ ...toRaw(item) }))
  } else {
    sanitized = data.map((item) => ({ ...item }))
  }

  // ✅ Log sanitized output once
  logger.debug('Sanitized Deck.gl data sample', {
    sample: sanitized.slice(0, 5),
    total: sanitized.length
  }) // limit to 5 for readability
  return markRaw(sanitized as T[])
}

function computeCentroid(position: [number, number, number][]) {
  if (!position.length) return
  const n = position.length
  const sum = position.reduce(
    (acc, p) => {
      acc[0] += p[0]
      acc[1] += p[1]
      acc[2] += p[2]
      return acc
    },
    [0, 0, 0]
  )
  const avg = sum.map((c) => c / n)
  if (avg.every(Number.isFinite)) {
    deck3DConfigStore.centroid = avg as [number, number, number]
  }
  //console.log('Centroid:', deck3DConfigStore.centroid);
}

function initDeckIfNeeded(deckContainer: Ref<HTMLDivElement | null>): boolean {
  const container = deckContainer.value
  if (!container) {
    logger.warn('Deck container is null')
    return false
  }

  if (!deckInstance.value) {
    createDeck(container)
  }
  return true
}

export function finalizeDeck() {
  if (deckInstance.value) {
    deckInstance.value.finalize()
    deckInstance.value = null
    //console.log('Deck instance finalized');
  } else {
    logger.warn('No Deck instance to finalize')
  }
}

/**
 * Check if 3D data is loaded and ready for rendering.
 * Use this to guard render calls that might be triggered before data loading completes.
 */
export function is3DDataLoaded(): boolean {
  return lastLoadedReqId !== null && cachedRawData.length > 0
}

/**
 * Check if the transform cache is populated (needed for coordinate transformation).
 * This is populated after renderCachedData() runs successfully.
 */
export function isTransformCacheReady(): boolean {
  return transformCache !== null && cachedPointCloudData.length > 0
}

export function recreateDeck(deckContainer: Ref<HTMLDivElement | null>): boolean {
  if (!deckContainer?.value) {
    logger.warn('Cannot recreate deck: container is null')
    return false
  }

  const { width, height } = deckContainer.value.getBoundingClientRect()
  if (width === 0 || height === 0) {
    logger.warn('Cannot recreate deck: container has zero size', { width, height })
    return false
  }

  // Finalize existing deck if present
  if (deckInstance.value) {
    logger.debug('Finalizing existing deck before recreation', {
      oldWidth: deckInstance.value.width,
      oldHeight: deckInstance.value.height
    })
    deckInstance.value.finalize()
    deckInstance.value = null
  }

  // Create fresh deck instance
  createDeck(deckContainer.value)

  logger.debug('Deck instance recreated', { width, height })
  return true
}

function createDeck(container: HTMLDivElement) {
  //console.log('createDeck inside:', container);
  deckInstance.value = new Deck({
    parent: container,
    useDevicePixels: false,
    _animate: true, // Enable animation to ensure initial render
    views: [
      new OrbitView({
        id: viewId,
        orbitAxis: deck3DConfigStore.orbitAxis,
        fovy: deck3DConfigStore.fovy
      })
    ],
    controller: {
      type: OrbitController,
      inertia: 0,
      scrollZoom: {
        speed: deck3DConfigStore.zoomSpeed,
        smooth: false
      },
      keyboard: {
        zoomSpeed: deck3DConfigStore.zoomSpeed,
        moveSpeed: deck3DConfigStore.panSpeed,
        rotateSpeedX: deck3DConfigStore.rotateSpeed,
        rotateSpeedY: deck3DConfigStore.rotateSpeed
      }
    },
    initialViewState: {
      [viewId]: {
        target: deck3DConfigStore.centroid,
        zoom: deck3DConfigStore.fitZoom,
        rotationX: deck3DConfigStore.viewState.rotationX,
        rotationOrbit: deck3DConfigStore.viewState.rotationOrbit
      }
    },
    layers: [],
    onViewStateChange: ({ viewState }) => {
      deck3DConfigStore.updateViewState(viewState)
    },
    onHover: (info) => {
      // Feature 3: Update location finder on 2D map when hovering over 3D points
      // Also show hover marker in 3D view at the hovered point
      // Only active when "Link to Plot" is enabled
      const globalChartStore = useGlobalChartStore()

      if (!globalChartStore.enableLocationFinder) {
        return // Respect "Link to Plot" toggle
      }

      if (info.object && info.object.lat !== undefined && info.object.lon !== undefined) {
        // Update 2D map location finder
        globalChartStore.locationFinderLat = info.object.lat
        globalChartStore.locationFinderLon = info.object.lon

        // Show hover marker in 3D view at the hovered point's position
        if (info.object.position) {
          deck3DConfigStore.hoverMarkerPosition = info.object.position
          deck3DConfigStore.hoverMarkerColor = [0, 255, 255, 255] // Cyan for 3D hover
          deck3DConfigStore.hoverMarkerSizeMultiplier = 5 // Make marker visible
        }
      } else {
        // Mouse left point - hide markers
        globalChartStore.locationFinderLat = NaN
        globalChartStore.locationFinderLon = NaN
        deck3DConfigStore.hoverMarkerPosition = null
      }
    },
    getTooltip: (info) => {
      if (!info.object) return null
      const { lat, lon, elevation, cycle, time, colorByLabel, colorByValue } = info.object

      const timeStr = time ? formatTime(time) : '?'
      const colorByHtml = colorByLabel
        ? `<strong>Color by:</strong> ${colorByLabel}${colorByValue !== null ? ` = ${colorByValue}` : ''}<br>`
        : ''

      const recordIdStr = recTreeStore.selectedReqIdStr || '?'

      return {
        html: `
                <div>
                    <strong>Record ID:</strong> <em>${recordIdStr}</em><br>
                    <strong>Longitude:</strong> ${lon?.toFixed(5)}<br>
                    <strong>Latitude:</strong> ${lat?.toFixed(5)}<br>
                    <strong>Elevation (Z):</strong> ${Number.isFinite(elevation) ? elevation.toFixed(2) : '?'} m<br>
                    <strong>Cycle:</strong> ${cycle ?? '?'}<br>
                    ${colorByHtml}
                    <strong>Time:</strong> ${timeStr}<br>
                </div>
                `,
        className: 'deck-3d-tooltip',
        style: {
          background: 'rgba(20, 20, 20, 0.85)',
          color: 'white',
          padding: '8px',
          fontSize: '13px',
          borderRadius: '4px',
          maxWidth: '250px',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
          boxSizing: 'border-box',
          zIndex: '9999',
          pointerEvents: 'none'
        }
      }
    },
    debug: deck3DConfigStore.debug,
    getCursor: () => 'default' // Use arrow cursor instead of hand
  })
}

function getPercentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

/**
 * [SLOW] Fetches data from DB, processes it, and stores it in the cache.
 * Should only be called when the request ID changes.
 */
export async function loadAndCachePointCloudData(reqId: number) {
  const toast = useSrToastStore()
  latField = fieldStore.getLatFieldName(reqId)
  lonField = fieldStore.getLonFieldName(reqId)
  heightField = fieldStore.getHFieldName(reqId)
  timeField = fieldStore.getTimeFieldName(reqId)

  if (reqId === lastLoadedReqId) {
    //console.log(`Data for reqId ${reqId} is already cached.`);
    return
  }
  //console.log(`Loading new data for reqId ${reqId}...`);

  try {
    const fieldStore = useFieldNameStore()
    const fileName = await indexedDb.getFilename(reqId)
    if (!fileName) throw new Error('Filename not found')

    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)

    // Check if geometry column exists and build appropriate SELECT
    const colTypes = await duckDbClient.queryColumnTypes(fileName)
    const hasGeometry = colTypes.some((c) => c.name === 'geometry')

    let selectClause: string
    if (hasGeometry) {
      // Check if Z column exists as a separate column
      // If it does, geometry is 2D (Point) and Z is stored separately
      // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
      const hasZColumn = colTypes.some((c) => c.name === heightField)
      const geometryHasZ = !hasZColumn // Z is in geometry if there's no separate Z column

      // Build column list: all columns except geometry (and z column if it's in geometry)
      const nonGeomCols = colTypes
        .filter((c) => {
          if (c.name === 'geometry') return false
          // If Z is in geometry, exclude the separate Z column
          if (geometryHasZ && c.name === heightField) return false
          return true
        })
        .map((c) => {
          // Extract time columns as nanoseconds (BigInt) to match CSV export format
          // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
          const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
          if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
            return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
          }
          return duckDbClient.escape(c.name)
        })

      // Add geometry extractions with field name aliases
      const geomExtractions = [
        `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
        `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
      ]

      // Only extract Z from geometry if it has Z, otherwise include the separate column
      if (geometryHasZ) {
        geomExtractions.push(
          `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
        )
      } else {
        // Z is a separate column, already included in nonGeomCols
      }

      selectClause = [...nonGeomCols, ...geomExtractions].join(', ')
    } else {
      // No geometry - build column list to properly handle time columns with epoch_ns
      const allCols = colTypes.map((c) => {
        // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
        const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
        if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
          return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
        }
        return duckDbClient.escape(c.name)
      })
      selectClause = allCols.join(', ')
    }

    const sample_fraction = await computeSamplingRate(reqId)
    const query = `SELECT ${selectClause} FROM read_parquet('${fileName}')`
    const result = await duckDbClient.queryChunkSampled(query, sample_fraction)
    const { value: rows = [] } = await result.readRows().next()

    if (rows.length > 0) {
      const filteredRows = rows.filter((d) => {
        const lon = d[lonField]
        const lat = d[latField]
        const elev = d[heightField]
        return (
          typeof lon === 'number' &&
          Number.isFinite(lon) &&
          typeof lat === 'number' &&
          Number.isFinite(lat) &&
          typeof elev === 'number' &&
          Number.isFinite(elev)
        )
      })
      cachedRawData = sanitizeDeckData(filteredRows)
      lastLoadedReqId = reqId
      verticalExaggerationInitialized = false // Reset flag for new data
      //console.log(`Cached ${cachedRawData.length} valid data points.`);

      if (cachedRawData.length > 0) {
        latField = fieldStore.getLatFieldName(reqId)
        lonField = fieldStore.getLonFieldName(reqId)
        heightField = fieldStore.getHFieldName(reqId)

        // Compute min/max
        let elevMin = Infinity,
          elevMax = -Infinity
        let latMin = Infinity,
          latMax = -Infinity
        let lonMin = Infinity,
          lonMax = -Infinity

        for (const row of cachedRawData) {
          const lat = row[latField]
          const lon = row[lonField]
          const elev = row[heightField]
          if (typeof lat === 'number' && isFinite(lat)) {
            latMin = Math.min(latMin, lat)
            latMax = Math.max(latMax, lat)
          }
          if (typeof lon === 'number' && isFinite(lon)) {
            lonMin = Math.min(lonMin, lon)
            lonMax = Math.max(lonMax, lon)
          }
          if (typeof elev === 'number' && isFinite(elev)) {
            elevMin = Math.min(elevMin, elev)
            elevMax = Math.max(elevMax, elev)
          }
        }
      }
    } else {
      cachedRawData = []
      lastLoadedReqId = null
      toast.warn('No Data Processed', 'No elevation data returned from query.')
    }
  } catch (err) {
    logger.error('Error loading 3D view data', {
      error: err instanceof Error ? err.message : String(err)
    })
    toast.error('Error', 'Failed to load elevation data.')
    cachedRawData = []
    lastLoadedReqId = null
  }
}

/**
 * [FAST] Uses the cached data to regenerate and render layers.
 * This is safe to call frequently (e.g., from debounced UI handlers).
 */
// add at top if not already present

export function renderCachedData(deckContainer: Ref<HTMLDivElement | null>) {
  if (!deckContainer || !deckContainer.value) {
    logger.warn('Deck container is null or undefined')
    return
  }
  if (!initDeckIfNeeded(deckContainer)) return

  const deck3DConfigStore = useDeck3DConfigStore()
  const elevationStore = useElevationColorMapStore()
  const fieldStore = useFieldNameStore()

  if (!cachedRawData.length || lastLoadedReqId === null) {
    logger.warn('No cached data available or last request ID is null')
    deckInstance.value?.setProps({ layers: [] })
    return
  }

  // --- fast, in-memory processing ---
  const selectedColorField = chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr)
  //console.log('renderCachedData: selectedColorField:', selectedColorField, ' for reqId:', recTreeStore.selectedReqIdStr);
  const zField = fieldStore.getHFieldName(lastLoadedReqId)

  // helper
  const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

  // Gather arrays once
  const elevations = cachedRawData
    .map((d) => d[zField])
    .filter(isFiniteNumber)
    .sort((a, b) => a - b)

  // choose color field (fallback to zField if not present or not numeric)
  const hasColorField =
    selectedColorField && cachedRawData.some((d) => isFiniteNumber(d[selectedColorField]))

  const cField = hasColorField ? selectedColorField : zField

  // percentiles for COLOR scale come from the color values
  const colorValues = cachedRawData
    .map((d: any) => d[cField])
    .filter(isFiniteNumber)
    .sort((a, b) => a - b)

  if (colorValues.length === 0) {
    // fall back to elevations to avoid NaN ranges
    colorValues.push(...elevations)
  }
  const colorMin = getPercentile(colorValues, deck3DConfigStore.minColorPercent)
  const colorMax = getPercentile(colorValues, deck3DConfigStore.maxColorPercent)
  const colorRange = Math.max(1e-6, colorMax - colorMin)
  //console.log(`renderCachedData hasColorField: ${hasColorField}, color field: ${cField} [${colorMin.toFixed(2)}, ${colorMax.toFixed(2)}] based on ${colorValues.length} samples`);
  // percentiles for Z scale still come from elevations
  const [minElScalePercent, maxElScalePercent] = deck3DConfigStore.elScaleRange
  const elevMinScale = getPercentile(elevations, minElScalePercent)
  const elevMaxScale = getPercentile(elevations, maxElScalePercent)

  // data window (filter) still based on elevations
  const [minElDataPercent, maxElDataPercent] = deck3DConfigStore.elDataRange
  const elevMinData = getPercentile(elevations, minElDataPercent)
  const elevMaxData = getPercentile(elevations, maxElDataPercent)

  // geographic bounds (degrees)
  const lonMin = Math.min(...cachedRawData.map((d) => d[lonField]))
  const lonMax = Math.max(...cachedRawData.map((d) => d[lonField]))
  const latMin = Math.min(...cachedRawData.map((d) => d[latField]))
  const latMax = Math.max(...cachedRawData.map((d) => d[latField]))
  const lonMid = 0.5 * (lonMin + lonMax)
  const latMid = 0.5 * (latMin + latMax)

  // choose a local metric CRS
  const dstCrs = pickLocalMetricCRS(latMid, lonMid)

  // project SW/NE to meters → extents
  const [Emin, Nmin] = proj4('EPSG:4326', dstCrs, [lonMin, latMin])
  const [Emax, Nmax] = proj4('EPSG:4326', dstCrs, [lonMax, latMax])

  const Erange = Math.max(1e-6, Emax - Emin)
  const Nrange = Math.max(1e-6, Nmax - Nmin)

  // ---- Longest-axis scaling (XY) ----
  const targetScale = deck3DConfigStore.scale // length of the longest side in world units
  const longestRange = Math.max(Erange, Nrange)
  const metersToWorld = targetScale / longestRange // COMMON factor for X and Y

  const scaleX = Erange * metersToWorld // ≤ targetScale
  const scaleY = Nrange * metersToWorld // ≤ targetScale

  // ---- Isotropic Z (meters → world) ----
  const h0 = elevMinScale // base plane for Z (matches percentile window)
  const zRangeMeters = Math.max(1e-6, elevMaxScale - elevMinScale)

  // Calculate vertical scale ratio based on z range vs x range
  const calculatedVerticalScaleRatio = Erange / zRangeMeters
  //console.log(`Calculated verticalScaleRatio: ${calculatedVerticalScaleRatio.toFixed(2)} (Erange: ${Erange.toFixed(2)} m, zRange: ${zRangeMeters.toFixed(2)} m)`);
  deck3DConfigStore.verticalScaleRatio = calculatedVerticalScaleRatio

  // Set vertical exaggeration to 1/2 of the calculated ratio (only once per dataset)
  if (!verticalExaggerationInitialized) {
    deck3DConfigStore.verticalExaggeration = calculatedVerticalScaleRatio / 2
    verticalExaggerationInitialized = true
    //console.log(`Initialized verticalExaggeration to: ${deck3DConfigStore.verticalExaggeration.toFixed(2)}`);
  }

  const zToWorld = metersToWorld * deck3DConfigStore.verticalExaggeration
  const scaleZ = zToWorld * zRangeMeters // Z axis length to pass to axes

  elevationStore.updateElevationColorMapValues()
  const rgbaArray = elevationStore.elevationColorMap

  // Map cached data → world coords
  const pointCloudData = cachedRawData
    .filter((d) => {
      const h = d[zField]
      return isFiniteNumber(h) && h >= elevMinData && h <= elevMaxData
    })
    .map((d) => {
      const [E, N] = proj4('EPSG:4326', dstCrs, [d[lonField], d[latField]])
      // origin = SW corner → same framing; uniform metersToWorld keeps aspect ratio
      const x = metersToWorld * (E - Emin) // East (m → world)
      const y = metersToWorld * (N - Nmin) // North (m → world)
      const z = zToWorld * ((d[zField] as number) - h0) // Up

      // --- COLOR from cField (fallback handled above) ---
      const rawVal = d[cField] as number
      const colorVal = Math.max(colorMin, Math.min(colorMax, rawVal))
      const colorNorm = (colorVal - colorMin) / colorRange
      const idx = Math.floor(colorNorm * (rgbaArray.length - 1))
      const rawColor = rgbaArray[Math.max(0, Math.min(idx, rgbaArray.length - 1))] ?? [
        255, 255, 255, 1
      ]
      const color = [
        Math.round(rawColor[0]),
        Math.round(rawColor[1]),
        Math.round(rawColor[2]),
        Math.round(rawColor[3] * 255)
      ]
      // Build a single "color-by" descriptor.
      // We *always* show Elevation and Cycle lines separately in the tooltip.
      // If color-by is Elevation or Cycle, we just show the label (no duplicate value).
      const colorByLabel = cField === zField ? 'Elevation' : cField === 'cycle' ? 'Cycle' : cField

      const colorByValue =
        cField === zField || cField === 'cycle' ? null : isFiniteNumber(rawVal) ? rawVal : null

      return {
        position: [x, y, z] as [number, number, number],
        color,
        lat: d[latField],
        lon: d[lonField],
        elevation: d[zField],
        track: d['track'] ?? null,
        spot: d['spot'] ?? null,
        cycle: d['cycle'] ?? null,
        rgt: d['rgt'] ?? null,
        time: d[timeField] ?? null,
        colorByLabel,
        colorByValue
      }
    })

  const sanitizedPointCloudData = sanitizeDeckData(pointCloudData)

  // Store transformation cache for coordinate transformation (2D map hover -> 3D)
  transformCache = {
    dstCrs,
    lonMin,
    latMin,
    metersToWorld,
    h0,
    zToWorld
  }

  // Store cached point cloud data for hover marker positioning
  cachedPointCloudData = pointCloudData

  computeCentroid(pointCloudData.map((p) => p.position))

  // --- Layer creation ---
  const layer = new PointCloudLayer({
    id: 'point-cloud-layer',
    data: sanitizedPointCloudData,
    getPosition: (d) => d.position,
    getColor: (d) => d.color,
    pointSize: deck3DConfigStore.pointSize,
    opacity: 0.95,
    pickable: true
  })

  const layers: Layer<any>[] = [layer]

  // --- Feature 1: Selection highlight layer ---
  const globalChartStore = useGlobalChartStore()
  const selectedTracks = globalChartStore.getTracks()
  const selectedSpots = globalChartStore.getSpots()
  const selectedCycles = globalChartStore.getCycles()
  const selectedRgt = globalChartStore.getRgt()

  // Check if there's an active selection
  const hasSelection =
    selectedTracks.length > 0 ||
    selectedSpots.length > 0 ||
    selectedCycles.length > 0 ||
    selectedRgt !== -1

  // logger.debug('Selection state for 3D highlight', {
  //   selectedTracks,
  //   selectedSpots,
  //   selectedCycles,
  //   selectedRgt,
  //   hasSelection,
  //   samplePointData: pointCloudData.length > 0 ? {
  //     track: pointCloudData[0].track,
  //     spot: pointCloudData[0].spot,
  //     cycle: pointCloudData[0].cycle,
  //     rgt: pointCloudData[0].rgt
  //   } : null
  // })

  if (hasSelection) {
    // Filter points that match the selection criteria
    // Note: ICESat-2 data uses spot/cycle/rgt, not track. GEDI uses track/orbit/beam.
    // Only apply filters when the field exists in the data AND there's a selection for it.
    const selectedPointCloudData = pointCloudData.filter((d) => {
      // Track filtering: only apply if data has track field AND tracks are selected
      // For ICESat-2, track is null so this is skipped
      const trackMatch =
        selectedTracks.length === 0 || d.track === null || selectedTracks.includes(d.track)

      // Spot filtering: only apply if spots are selected AND data has spot field
      const spotMatch =
        selectedSpots.length === 0 || d.spot === null || selectedSpots.includes(d.spot)

      // Cycle filtering: only apply if cycles are selected AND data has cycle field
      const cycleMatch =
        selectedCycles.length === 0 || d.cycle === null || selectedCycles.includes(d.cycle)

      // RGT filtering: only apply if rgt is selected (not -1) AND data has rgt field
      const rgtMatch = selectedRgt === -1 || d.rgt === null || d.rgt === selectedRgt

      return trackMatch && spotMatch && cycleMatch && rgtMatch
    })

    // logger.debug('Selection highlight filtering', {
    //   totalPoints: pointCloudData.length,
    //   selectedPoints: selectedPointCloudData.length
    // })

    if (selectedPointCloudData.length > 0) {
      const highlightedLayer = new PointCloudLayer({
        id: 'point-cloud-layer-selected',
        data: sanitizeDeckData(selectedPointCloudData),
        getPosition: (d) => d.position,
        getColor: () => deck3DConfigStore.highlightColor,
        pointSize: deck3DConfigStore.pointSize * deck3DConfigStore.highlightedPointSizeMultiplier,
        opacity: 1.0,
        pickable: true
      })
      layers.push(highlightedLayer)
    }
  }

  // --- Feature 2: Hover marker layer (2D map hover -> 3D marker) ---
  // Uses SimpleMeshLayer with SphereGeometry for a 3D sphere visible from all angles
  // Size is calculated as a percentage of the smallest data extent, adjustable via hoverMarkerScale
  if (deck3DConfigStore.hoverMarkerPosition) {
    const sphereGeometry = new SphereGeometry({ radius: 1, nlat: 16, nlong: 16 })
    // Calculate marker size based on data extent (use smallest axis for reference)
    const minExtent = Math.min(scaleX, scaleY, scaleZ)
    const markerSize = minExtent * (deck3DConfigStore.hoverMarkerScale / 100) // hoverMarkerScale is percentage
    const markerLayer = new SimpleMeshLayer({
      id: 'hover-marker-layer',
      data: [
        {
          position: deck3DConfigStore.hoverMarkerPosition
        }
      ],
      mesh: sphereGeometry,
      getPosition: (d: any) => d.position,
      getColor: [255, 0, 0, 255], // Red sphere
      sizeScale: markerSize,
      pickable: false
    })
    layers.push(markerLayer)
  }

  if (deck3DConfigStore.showAxes) {
    layers.push(
      ...createAxesAndLabels(
        /* scaleX */ scaleX,
        /* scaleY */ scaleY,
        /* scaleZ */ scaleZ,
        'East',
        'North',
        'Elev (m)',
        [255, 255, 255], // text color
        [200, 200, 200], // line color
        5, // font size
        1, // line width
        elevMinScale,
        elevMaxScale,
        /* N meters */ Nmin,
        Nmax,
        /* E meters */ Emin,
        Emax
      )
    )
  }

  deckInstance.value?.setProps({ layers })
}

export function updateFovy(fovy: number) {
  deckInstance.value?.setProps({
    views: [
      new OrbitView({
        id: viewId,
        orbitAxis: deck3DConfigStore.orbitAxis,
        fovy: fovy
      })
    ]
  })
}

/**
 * Find the nearest point's elevation from cached data given lat/lon coordinates.
 * Uses simple linear search (data is already sampled, so n is manageable).
 */
export function findNearestPointElevation(lat: number, lon: number): number | null {
  if (!cachedPointCloudData.length) return null

  let minDist = Infinity
  let nearestElev: number | null = null

  for (const point of cachedPointCloudData) {
    const dLat = point.lat - lat
    const dLon = point.lon - lon
    const dist = dLat * dLat + dLon * dLon // squared distance
    if (dist < minDist) {
      minDist = dist
      nearestElev = point.elevation
    }
  }

  return nearestElev
}

/**
 * Transform lat/lon coordinates to 3D world coordinates.
 * Uses the cached transformation parameters from the last render.
 * Returns null if no transformation cache is available.
 */
export function transformLatLonTo3DWorld(
  lat: number,
  lon: number
): [number, number, number] | null {
  if (!transformCache || !cachedPointCloudData.length) {
    return null
  }

  const { dstCrs, lonMin, latMin, metersToWorld, h0, zToWorld } = transformCache

  // Find elevation at this location (use nearest point)
  const elevation = findNearestPointElevation(lat, lon)
  if (elevation === null) {
    return null
  }

  // Transform to local metric CRS
  const [E, N] = proj4('EPSG:4326', dstCrs, [lon, lat])
  const [Emin, Nmin] = proj4('EPSG:4326', dstCrs, [lonMin, latMin])

  // Convert to world coordinates (same transformation as in renderCachedData)
  const x = metersToWorld * (E - Emin)
  const y = metersToWorld * (N - Nmin)
  const z = zToWorld * (elevation - h0)

  return [x, y, z]
}
