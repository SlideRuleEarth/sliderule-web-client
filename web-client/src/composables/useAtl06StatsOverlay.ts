import { ref } from 'vue'
import type OLMap from 'ol/Map.js'
import ImageLayer from 'ol/layer/Image.js'
import ImageSource from 'ol/source/Image.js'
import { getTransform } from 'ol/proj.js'
import type { Extent } from 'ol/extent.js'
import colormap from 'colormap'
import { lonLatToFaceST, faceIJToCellIdHex } from '@/utils/s2CellGrid'
import {
  listStatFiles,
  readStatTile,
  StatsAccessError,
  MAX_FILE_LEVEL,
  STAT_LEVEL_DELTA,
  TILE_SIDE,
  type StatColumn,
  type StatTile
} from '@/utils/atl06StatsReader'
import { useReqMsgLogStore } from '@/stores/reqMsgLogStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl06StatsOverlay')

const SAMPLE_STEP = 2 // screen pixels per raster pixel; stat cells are about a pixel wide at the chosen level
const MAX_CONCURRENT_READS = 8
const MAX_CACHED_TILES = 600
const MAX_PERCENTILE_SAMPLES = 20000

const VIRIDIS = colormap({
  colormap: 'viridis',
  nshades: 256,
  format: 'rgba',
  alpha: 1
}) as unknown as number[][]
export const VIRIDIS_CSS_GRADIENT = `linear-gradient(to right, ${[0, 64, 128, 192, 255]
  .map((k) => `rgb(${VIRIDIS[k][0]},${VIRIDIS[k][1]},${VIRIDIS[k][2]})`)
  .join(', ')})`

interface Raster {
  width: number
  height: number
  extent: Extent
  resolution: number
  tileHexes: string[] // per view, the files covering the raster
  tileOfPixel: Int32Array // index into tileHexes, -1 where off the globe
  cellOfPixel: Int32Array // stat cell index within the tile
}

export interface StatsLegend {
  min: number
  max: number
  isTime: boolean
}

/** Display name of a stats column: the column without its _mean suffix. */
export function statColumnLabel(column: string): string {
  return column.replace(/_mean$/, '')
}

/**
 * Raster of one ATL06 stat column (atl06tv4/stats) for the S2 level the grid is drawn at.
 */
export function useAtl06StatsOverlay() {
  const layer = new ImageLayer<ImageSource>({ zIndex: 30, opacity: 0.85, visible: false })
  layer.set('name', 'ATL06 stats')
  layer.set('displayInLayerSwitcher', false)

  const status = ref('')
  const legend = ref<StatsLegend | null>(null)
  const meanColumns = ref<StatColumn[]>([])

  const tiles = new Map<string, StatTile | null>() // keyed column:hex, insertion ordered for LRU eviction
  const inflight = new Set<string>()
  let queue: { key: string; hex: string; level: number }[] = []
  let sizes: Map<string, number> | null = null
  let raster: Raster | null = null
  let column = 'h_li_mean'
  let generation = 0
  let paintScheduled = false
  let lastNotice = ''
  const canvas = document.createElement('canvas')

  // the same problem is logged once, not on every pan or zoom
  function notify(message: string) {
    if (message === lastNotice) return
    lastNotice = message
    useReqMsgLogStore().add('warn', 'S2 Cells', message)
  }

  function tileKey(hex: string): string {
    return `${column}:${hex}`
  }

  function cacheTile(key: string, tile: StatTile | null) {
    tiles.delete(key)
    tiles.set(key, tile)
    if (tile && meanColumns.value.length === 0) meanColumns.value = tile.meanColumns
    while (tiles.size > MAX_CACHED_TILES) {
      tiles.delete(tiles.keys().next().value as string)
    }
  }

  function clear() {
    generation++
    queue = []
    raster = null
    legend.value = null
    layer.setSource(null)
  }

  // forget files that failed or were missing under the previous credentials
  function resetCache() {
    clear()
    tiles.clear()
  }
  function buildRaster(map: OLMap, fileLevel: number): Raster | null {
    const size = map.getSize()
    const view = map.getView()
    const viewResolution = view.getResolution()
    if (!size || !viewResolution) return null
    const width = Math.ceil(size[0] / SAMPLE_STEP)
    const height = Math.ceil(size[1] / SAMPLE_STEP)
    const resolution = viewResolution * SAMPLE_STEP
    const [cx, cy] = view.getCenter() ?? [0, 0]
    const minX = cx - (width * resolution) / 2
    const maxY = cy + (height * resolution) / 2
    const extent: Extent = [minX, maxY - height * resolution, minX + width * resolution, maxY]

    const coords = new Float64Array(width * height * 2)
    for (let row = 0, k = 0; row < height; row++) {
      const y = maxY - (row + 0.5) * resolution
      for (let col = 0; col < width; col++, k += 2) {
        coords[k] = minX + (col + 0.5) * resolution
        coords[k + 1] = y
      }
    }
    // OL transform functions index into the arrays, so a typed array works and avoids boxing
    const flat = coords as unknown as number[]
    getTransform(view.getProjection(), 'EPSG:4326')(flat, flat, 2)

    const statLevel = fileLevel + STAT_LEVEL_DELTA
    const cells = 1 << statLevel
    const mask = TILE_SIDE - 1
    const st = new Float64Array(2)
    const tileOfPixel = new Int32Array(width * height)
    const cellOfPixel = new Int32Array(width * height)
    const tileIndexByKey = new Map<number, number>()
    const tileHexes: string[] = []
    for (let p = 0; p < width * height; p++) {
      const lon = coords[2 * p]
      const lat = coords[2 * p + 1]
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) {
        tileOfPixel[p] = -1
        continue
      }
      const face = lonLatToFaceST(lon, lat, st)
      const i = Math.min(cells - 1, Math.floor(st[0] * cells))
      const j = Math.min(cells - 1, Math.floor(st[1] * cells))
      const fi = i >> STAT_LEVEL_DELTA
      const fj = j >> STAT_LEVEL_DELTA
      const key = (face * TILE_SIDE + fi) * TILE_SIDE + fj
      let index = tileIndexByKey.get(key)
      if (index === undefined) {
        index = tileHexes.length
        tileIndexByKey.set(key, index)
        tileHexes.push(faceIJToCellIdHex(face, fi, fj, fileLevel))
      }
      tileOfPixel[p] = index
      cellOfPixel[p] = (i & mask) * TILE_SIDE + (j & mask)
    }
    return { width, height, extent, resolution, tileHexes, tileOfPixel, cellOfPixel }
  }

  function schedulePaint() {
    if (paintScheduled) return
    paintScheduled = true
    requestAnimationFrame(() => {
      paintScheduled = false
      paint()
    })
  }

  function paint() {
    const r = raster
    if (!r) return
    const tileValues = r.tileHexes.map((hex) => tiles.get(tileKey(hex))?.values ?? null)
    const n = r.width * r.height
    const values = new Float32Array(n).fill(NaN)
    let found = 0
    for (let p = 0; p < n; p++) {
      const t = r.tileOfPixel[p]
      if (t < 0) continue
      const tileValuesForPixel = tileValues[t]
      if (!tileValuesForPixel) continue
      const v = tileValuesForPixel[r.cellOfPixel[p]]
      if (v === v) {
        values[p] = v
        found++
      }
    }
    if (found === 0) {
      // keep the previous (still geo-referenced) image until this view's files arrive
      if (queue.length + inflight.size === 0) {
        legend.value = null
        layer.setSource(null)
      }
      return
    }

    const stride = Math.max(1, Math.floor(found / MAX_PERCENTILE_SAMPLES))
    const samples: number[] = []
    for (let p = 0, seen = 0; p < n; p++) {
      if (values[p] === values[p] && seen++ % stride === 0) samples.push(values[p])
    }
    samples.sort((a, b) => a - b)
    const min = samples[Math.floor(samples.length * 0.02)]
    let max = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.98))]
    if (max <= min) max = min + 1
    legend.value = {
      min,
      max,
      isTime: meanColumns.value.find((c) => c.name === column)?.isTime ?? false
    }

    canvas.width = r.width
    canvas.height = r.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(r.width, r.height)
    const rgba = image.data
    const scale = 255 / (max - min)
    for (let p = 0; p < n; p++) {
      const v = values[p]
      if (v !== v) continue
      const c = VIRIDIS[Math.max(0, Math.min(255, Math.floor((v - min) * scale)))]
      rgba[4 * p] = c[0]
      rgba[4 * p + 1] = c[1]
      rgba[4 * p + 2] = c[2]
      rgba[4 * p + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    const { extent, resolution } = r
    layer.setSource(
      new ImageSource({
        interpolate: false,
        loader: () => ({ image: canvas, extent, resolution, pixelRatio: 1 })
      })
    )
  }

  function updateStatus() {
    const r = raster
    if (!r) return
    const pending = queue.length + inflight.size
    const label = statColumnLabel(column)
    if (pending > 0) {
      status.value = `Loading ${label} (${pending} files)`
    } else {
      status.value = legend.value ? '' : `No ${label} data in view`
    }
  }

  function pump() {
    while (inflight.size < MAX_CONCURRENT_READS && queue.length) {
      const { key, hex, level } = queue.shift()!
      if (tiles.has(key) || inflight.has(key)) continue
      inflight.add(key)
      readStatTile(hex, level, sizes?.get(hex), key.slice(0, key.lastIndexOf(':')))
        .then((tile) => {
          lastNotice = ''
          cacheTile(key, tile)
          schedulePaint()
        })
        .catch((error) => {
          if (error instanceof StatsAccessError) {
            notify(error.message)
            clear()
            return
          }
          logger.warn('Failed to read stat file', {
            key,
            error: error instanceof Error ? error.message : String(error)
          })
          cacheTile(key, null)
        })
        .finally(() => {
          inflight.delete(key)
          updateStatus()
          if (queue.length + inflight.size === 0) schedulePaint()
          pump()
        })
    }
  }

  /**
   * Rebuild the raster of `statsColumn` for the map's current view; `gridLevel` is the level the
   * S2 lines are drawn at.
   */
  async function update(
    map: OLMap,
    gridLevel: number,
    enabled: boolean,
    hasCredentials: boolean,
    statsColumn: string
  ) {
    layer.setVisible(enabled)
    status.value = ''
    if (!enabled || !hasCredentials) {
      clear()
      if (enabled) notify('Log in or add S3 credentials in Settings to show ATL06 stats')
      return
    }
    if (statsColumn !== column) {
      column = statsColumn
      legend.value = null
      layer.setSource(null)
    }
    generation++
    queue = []
    const gen = generation
    const fileLevel = Math.min(gridLevel, MAX_FILE_LEVEL)
    const start = performance.now()
    raster = buildRaster(map, fileLevel)
    if (!raster) return
    logger.debug('Built stats raster', {
      fileLevel,
      files: raster.tileHexes.length,
      ms: Math.round(performance.now() - start)
    })

    try {
      sizes = await listStatFiles()
    } catch (error) {
      if (gen !== generation) return
      notify(
        error instanceof StatsAccessError ? error.message : 'Unable to read ATL06 stats from S3'
      )
      logger.error('Stat file listing failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return
    }
    if (gen !== generation || !raster) return
    queue = raster.tileHexes
      .map((hex) => ({ key: tileKey(hex), hex, level: fileLevel }))
      .filter(({ key, hex }) => !tiles.has(key) && (sizes === null || sizes.has(hex)))
    paint()
    updateStatus()
    pump()
  }

  return { layer, status, legend, meanColumns, update, clear, resetCache }
}
