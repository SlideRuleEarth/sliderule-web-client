import { type ExtLatLon } from '@/workers/workerUtils'
import type { SrRegion } from '@/types/SrTypes'

/**
 * Calculate ExtLatLon bounds from a polygon (array of lat/lon points)
 */
export function calculateBounds(poly: SrRegion): ExtLatLon | null {
  if (!poly || !Array.isArray(poly) || poly.length === 0) {
    return null
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity

  for (const point of poly) {
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
    if (point.lon < minLon) minLon = point.lon
    if (point.lon > maxLon) maxLon = point.lon
  }

  return { minLat, maxLat, minLon, maxLon }
}

/**
 * Normalize an angle (in degrees) to the range (-180, +180].
 */
function normalizeAngle(angle: number) {
  // First bring angle into [−180, +180) by shifting multiples of 360
  let result = angle % 360
  if (result > 180) {
    result -= 360
  } else if (result <= -180) {
    result += 360
  }
  return result
}

/**
 * Compute the midpoint of two longitudes (lon1, lon2), properly handling
 * crossing the ±180° meridian.
 */
function averageLongitude(lon1: number, lon2: number) {
  // Normalize each longitude to (−180, +180]
  lon1 = normalizeAngle(lon1)
  lon2 = normalizeAngle(lon2)

  // Find the difference, adjusting so that it's within (−180, +180]
  let diff = lon2 - lon1
  if (diff > 180) {
    diff -= 360
  } else if (diff <= -180) {
    diff += 360
  }

  // The midpoint is the first longitude plus half the (adjusted) difference
  const mid = lon1 + diff / 2

  // Normalize the result to (−180, +180], just in case
  return normalizeAngle(mid)
}

/**
 * Given an ExtLatLon bounding box, return an object with {lat, lon}
 * representing the center of the box, accounting for possible crossing of the 180° meridian.
 */
export function getCenter(extLatLon: ExtLatLon): { lat: number; lon: number } {
  const { minLat, maxLat, minLon, maxLon } = extLatLon

  // Average the latitudes
  const centerLat = (minLat + maxLat) / 2

  // Use the special average for longitudes
  const centerLon = averageLongitude(minLon, maxLon)

  return { lat: centerLat, lon: centerLon }
}
