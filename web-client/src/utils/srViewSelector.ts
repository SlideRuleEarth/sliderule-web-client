import { createLogger } from '@/utils/logger'
import type { ExtLatLon } from '@/workers/workerUtils'

const logger = createLogger('srViewSelector')

/**
 * Determines the best SrViewName based on geographic extent of data
 *
 * Logic:
 * - If data is primarily in high northern latitudes (> 60°N) → "North Alaska"
 * - If data is primarily in high southern latitudes (< -60°S) → "South Antarctic Polar Stereographic"
 * - Otherwise → "Global Mercator Esri" (default)
 *
 * @param extent - Geographic extent with min/max lat/lon
 * @returns The appropriate SrViewName key for srViews
 */
export function selectSrViewForExtent(extent: ExtLatLon): string {
  const { minLat, maxLat, minLon, maxLon } = extent

  logger.debug('Selecting SrView for extent', { minLat, maxLat, minLon, maxLon })

  // Validate extent
  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon)
  ) {
    logger.warn('Invalid extent, using default view', { extent })
    return 'Global Mercator Esri'
  }

  // Calculate latitude center and span
  const latCenter = (minLat + maxLat) / 2
  const latSpan = maxLat - minLat

  // Thresholds for polar projections based on tile availability
  // EPSG:5936 (Arctic Ocean Base) has tiles from 60°N to 89.9°N
  // EPSG:3031 (Antarctic) has tiles from 90°S to ~60°S
  const NORTH_THRESHOLD = 60 // Data primarily above 60°N (EPSG:5936 tile coverage)
  const SOUTH_THRESHOLD = -60 // Data primarily below 60°S (EPSG:3031 tile coverage)

  // Check if data is primarily in northern polar region
  // Use north view if:
  // 1. Minimum latitude is above 70°N (entire dataset in high Arctic), OR
  // 2. Center is above 75°N and most data (>70%) is in the polar region
  if (
    minLat > NORTH_THRESHOLD ||
    (latCenter > NORTH_THRESHOLD + 5 && minLat > NORTH_THRESHOLD - latSpan * 0.3)
  ) {
    logger.info('Data is in northern polar region, using North Alaska view', {
      minLat,
      maxLat,
      latCenter,
      selectedView: 'North Alaska'
    })
    return 'North Alaska'
  }

  // Check if data is primarily in southern polar region
  // Use south view if:
  // 1. Maximum latitude is below 70°S (entire dataset in high Antarctic), OR
  // 2. Center is below 75°S and most data (>70%) is in the polar region
  if (
    maxLat < SOUTH_THRESHOLD ||
    (latCenter < SOUTH_THRESHOLD - 5 && maxLat < SOUTH_THRESHOLD - latSpan * 0.3)
  ) {
    logger.info('Data is in southern polar region, using South view', {
      minLat,
      maxLat,
      latCenter,
      selectedView: 'South Antarctic Polar Stereographic'
    })
    return 'South Antarctic Polar Stereographic'
  }

  // Default to global Mercator projection for mid-latitudes
  logger.info('Data spans mid-latitudes, using Global Mercator view', {
    minLat,
    maxLat,
    latCenter,
    selectedView: 'Global Mercator Esri'
  })
  return 'Global Mercator Esri'
}
