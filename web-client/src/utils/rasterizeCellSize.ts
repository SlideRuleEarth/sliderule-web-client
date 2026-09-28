import { bbox } from '@turf/turf'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useGeoJsonStore } from '@/stores/geoJsonStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('RasterizeCellSize')

// The server sizes the region_mask raster as int(extent / cellsize) rows and columns
// (GeoJsonRaster.cpp in the server repo), so a cell size larger than the region's shorter
// side leaves the mask with no rows or columns and the request fails (issue #1125).

/** Smallest value the "Rasterize Polygon cell size" slider allows, in degrees */
export const MIN_RASTERIZE_CELL_SIZE = 0.0001

/** Cells across the region's shorter side that a fitted cell size gives */
export const FITTED_CELLS_ACROSS = 10

/** Shorter side, in degrees, of the envelope of everything in a GeoJSON object */
export function shorterSideOf(geojson: unknown): number | null {
  try {
    const [minX, minY, maxX, maxY] = bbox(geojson as Parameters<typeof bbox>[0])
    const side = Math.min(maxX - minX, maxY - minY)
    return Number.isFinite(side) ? side : null
  } catch {
    return null
  }
}

/**
 * The cell size to use for a region: the one given if it already puts FITTED_CELLS_ACROSS
 * cells across the region's shorter side, otherwise the largest slider step that does,
 * but never less than the slider minimum.
 */
export function fitCellSize(cellSize: number, shorterSide: number): number {
  const fitted = shorterSide / FITTED_CELLS_ACROSS
  if (cellSize <= fitted) return cellSize
  // the slider has four decimal places
  return Math.max(MIN_RASTERIZE_CELL_SIZE, Math.floor(fitted * 10000) / 10000)
}

/** True when the server can build the mask: at least one row and one column */
export function cellSizeFits(cellSize: number, shorterSide: number): boolean {
  return cellSize > 0 && cellSize <= shorterSide
}

/** The region the request sends as region_mask, if any (see getAtlReqParams) */
function regionMaskGeoJson(): unknown {
  const geoJsonStore = useGeoJsonStore()
  return geoJsonStore.reqHasPoly() ? geoJsonStore.getReqGeoJsonData() : null
}

/**
 * Lower the cell size, and say so, when the region mask is too small for it.
 * Called when a region is uploaded and when Rasterize is checked for a drawn polygon.
 */
export function fitRasterizeCellSizeToRegionMask(): void {
  const geojson = regionMaskGeoJson()
  const shorterSide = geojson ? shorterSideOf(geojson) : null
  if (shorterSide === null) return
  const reqParamsStore = useReqParamsStore()
  const current = reqParamsStore.getRasterizePolyCellSize()
  const fitted = fitCellSize(current, shorterSide)
  if (fitted === current) return
  reqParamsStore.setRasterizePolyCellSize(fitted)
  logger.info('Lowered rasterize cell size to fit the region', { current, fitted, shorterSide })
  useSrToastStore().info(
    'Rasterize cell size',
    `Lowered from ${current}° to ${fitted}° to fit the region.`
  )
}

/** Pre-run check: the server can't build a mask when the cell size is larger than the region */
export function checkRasterizeCellSizeError(): { ok: boolean; msg?: string } {
  const geojson = regionMaskGeoJson()
  const shorterSide = geojson ? shorterSideOf(geojson) : null
  const cellSize = useReqParamsStore().getRasterizePolyCellSize()
  if (shorterSide === null || cellSizeFits(cellSize, shorterSide)) return { ok: true }
  const narrowest = Number(shorterSide.toPrecision(2))
  return {
    ok: false,
    msg:
      `The rasterize cell size (${cellSize}°) is larger than the region, which is ` +
      `${narrowest}° across at its narrowest, so the server can't build the region mask. ` +
      'Lower "Rasterize Polygon cell size" in the Upload Region of Interest dialog, ' +
      'or use a larger region.'
  }
}
