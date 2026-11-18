import { toLonLat, fromLonLat, type ProjectionLike } from 'ol/proj.js'
import { getArea } from 'ol/sphere.js'
import Polygon from 'ol/geom/Polygon.js'
import type { Extent } from 'ol/extent.js'
import type { Coordinate } from 'ol/coordinate.js'
import { srProjections } from '@/composables/SrProjections'

// Dependency-free S2 geometry: cell edges at level L are the lines s = k/2^L and
// t = k/2^L on each of the six cube faces (quadratic UV projection, as in the S2 library).

export type Vec3 = [number, number, number]

export const S2_MAX_LEVEL = 30
const TARGET_VISIBLE_CELLS = 250
const SAMPLES_PER_SIDE = 32
const EARTH_AREA_M2 = 4 * Math.PI * 6371008.8 ** 2
const DEG = 180 / Math.PI

export function stToUV(s: number): number {
  return s >= 0.5 ? (4 * s * s - 1) / 3 : (1 - 4 * (1 - s) * (1 - s)) / 3
}

export function uvToST(u: number): number {
  return u >= 0 ? 0.5 * Math.sqrt(1 + 3 * u) : 1 - 0.5 * Math.sqrt(1 - 3 * u)
}

export function faceUVToXYZ(face: number, u: number, v: number): Vec3 {
  switch (face) {
    case 0:
      return [1, u, v]
    case 1:
      return [-u, 1, v]
    case 2:
      return [-u, -v, 1]
    case 3:
      return [-1, -v, -u]
    case 4:
      return [v, -1, -u]
    default:
      return [v, u, -1]
  }
}

export function xyzToFaceUV([x, y, z]: Vec3): [number, number, number] {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
  if ((face === 0 && x < 0) || (face === 1 && y < 0) || (face === 2 && z < 0)) face += 3
  switch (face) {
    case 0:
      return [0, y / x, z / x]
    case 1:
      return [1, -x / y, z / y]
    case 2:
      return [2, -x / z, -y / z]
    case 3:
      return [3, z / x, y / x]
    case 4:
      return [4, z / y, -x / y]
    default:
      return [5, -y / z, -x / z]
  }
}

export function lonLatToXYZ(lon: number, lat: number): Vec3 {
  const phi = lat / DEG
  const theta = lon / DEG
  const c = Math.cos(phi)
  return [c * Math.cos(theta), c * Math.sin(theta), Math.sin(phi)]
}

export function xyzToLonLat([x, y, z]: Vec3): [number, number] {
  return [Math.atan2(y, x) * DEG, Math.atan2(z, Math.hypot(x, y)) * DEG]
}

// S2 Hilbert curve tables (kSwapMask = 1, kInvertMask = 2), indexed [orientation * 4 + pos|ij]
const POS_TO_IJ = [0, 1, 3, 2, 0, 2, 3, 1, 3, 2, 0, 1, 3, 1, 0, 2]
const IJ_TO_POS = [0, 1, 3, 2, 0, 3, 1, 2, 2, 3, 1, 0, 2, 1, 3, 0]
const POS_TO_ORIENTATION = [1, 0, 0, 3]

/**
 * Face and (i, j) at `level` of an S2 cell id given as its high and low 32-bit words;
 * `out` receives [face, i, j]. The id must be at `level` or finer.
 */
export function cellIdToFaceIJ(hi: number, lo: number, level: number, out: Int32Array): void {
  const face = hi >>> 29
  let orientation = face & 1
  let i = 0
  let j = 0
  for (let k = 1; k <= level; k++) {
    // level k uses bits 62-2k and 61-2k; at k = 15 they straddle the two words
    const p = 61 - 2 * k
    const pos =
      p >= 32 ? (hi >>> (p - 32)) & 3 : p === 31 ? ((hi & 1) << 1) | (lo >>> 31) : (lo >>> p) & 3
    const ij = POS_TO_IJ[orientation * 4 + pos]
    i = (i << 1) | (ij >> 1)
    j = (j << 1) | (ij & 1)
    orientation ^= POS_TO_ORIENTATION[pos]
  }
  out[0] = face
  out[1] = i
  out[2] = j
}

/** 16 digit uppercase hex S2 cell id of the cell (face, i, j) at `level`. */
export function faceIJToCellIdHex(face: number, i: number, j: number, level: number): string {
  let orientation = face & 1
  let id = BigInt(face) << 61n
  for (let k = 1; k <= level; k++) {
    const shift = level - k
    const ij = (((i >> shift) & 1) << 1) | ((j >> shift) & 1)
    const pos = IJ_TO_POS[orientation * 4 + ij]
    id |= BigInt(pos) << BigInt(61 - 2 * k)
    orientation ^= POS_TO_ORIENTATION[pos]
  }
  id |= 1n << BigInt(60 - 2 * level)
  return id.toString(16).toUpperCase().padStart(16, '0')
}

/** Allocation-free lon/lat (degrees) to S2 face and (s, t); `out` receives [s, t]. */
export function lonLatToFaceST(lon: number, lat: number, out: Float64Array): number {
  const phi = lat / DEG
  const theta = lon / DEG
  const c = Math.cos(phi)
  const x = c * Math.cos(theta)
  const y = c * Math.sin(theta)
  const z = Math.sin(phi)
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face: number
  let u: number
  let v: number
  if (ax >= ay && ax >= az) {
    face = x >= 0 ? 0 : 3
    u = x >= 0 ? y / x : z / x
    v = x >= 0 ? z / x : y / x
  } else if (ay >= az) {
    face = y >= 0 ? 1 : 4
    u = y >= 0 ? -x / y : z / y
    v = y >= 0 ? z / y : -x / y
  } else {
    face = z >= 0 ? 2 : 5
    u = z >= 0 ? -x / z : -y / z
    v = z >= 0 ? -y / z : -x / z
  }
  out[0] = uvToST(u)
  out[1] = uvToST(v)
  return face
}

/**
 * Level 0 at the view's minimum zoom, then one level per zoom step until roughly
 * TARGET_VISIBLE_CELLS cells cover the visible area.
 */
export function chooseS2Level(visibleFraction: number, zoomAboveMin: number): number {
  const frac = Math.min(1, Math.max(visibleFraction, 1e-20))
  const areaLevel = Math.round(Math.log(TARGET_VISIBLE_CELLS / (6 * frac)) / Math.log(4))
  const zoomLevel = Math.floor(zoomAboveMin + 1e-6)
  return Math.min(S2_MAX_LEVEL, Math.max(0, Math.min(areaLevel, zoomLevel)))
}

/** Latitude band in which the projection can render S2 edges without blowing up. */
export function getS2LatRange(projectionName: string): [number, number] {
  const bbox = srProjections.value[projectionName]?.bbox
  if (!bbox) return [-90, 90]
  const minLat = bbox[1] >= 0 ? 0 : bbox[1] <= -89 ? -90 : bbox[1]
  const maxLat = bbox[3] <= 0 ? 0 : bbox[3] >= 89 ? 90 : bbox[3]
  return [minLat, maxLat]
}

interface FaceBounds {
  sMin: number
  sMax: number
  tMin: number
  tMax: number
}

interface ViewSample {
  visibleFraction: number
  faces: (FaceBounds | null)[]
}

function sampleView(extent: Extent, projection: ProjectionLike): ViewSample {
  const n = SAMPLES_PER_SIDE
  const [minX, minY, maxX, maxY] = extent
  const dx = (maxX - minX) / n
  const dy = (maxY - minY) / n
  const grid: (Coordinate | null)[][] = []
  const faces: (FaceBounds | null)[] = [null, null, null, null, null, null]

  for (let j = 0; j <= n; j++) {
    const row: (Coordinate | null)[] = []
    for (let i = 0; i <= n; i++) {
      const ll = toLonLat([minX + i * dx, minY + j * dy], projection)
      if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) {
        row.push(null)
        continue
      }
      row.push(ll)
      const [face, u, v] = xyzToFaceUV(lonLatToXYZ(ll[0], ll[1]))
      const s = uvToST(u)
      const t = uvToST(v)
      const b = faces[face]
      if (b) {
        b.sMin = Math.min(b.sMin, s)
        b.sMax = Math.max(b.sMax, s)
        b.tMin = Math.min(b.tMin, t)
        b.tMax = Math.max(b.tMax, t)
      } else {
        faces[face] = { sMin: s, sMax: s, tMin: t, tMax: t }
      }
    }
    grid.push(row)
  }

  let area = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const corners = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
      if (corners.some((c) => c === null)) continue
      const lon0 = corners[0]![0]
      const ring = corners.map((c) => [lon0 + wrap180(c![0] - lon0), c![1]])
      ring.push(ring[0])
      area += Math.abs(getArea(new Polygon([ring]), { projection: 'EPSG:4326' }))
    }
  }
  return { visibleFraction: area / EARTH_AREA_M2, faces }
}

function wrap180(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180
}

/** Converts a lon/lat polyline to view coordinates, splitting where it leaves the drawable area. */
function projectLine(
  lonLats: [number, number][],
  projection: ProjectionLike,
  latRange: [number, number]
): Coordinate[][] {
  const out: Coordinate[][] = []
  let current: Coordinate[] = []
  let prevLon: number | null = null
  for (const [rawLon, lat] of lonLats) {
    const lon: number = prevLon === null ? rawLon : prevLon + wrap180(rawLon - prevLon)
    prevLon = lon
    const p = lat >= latRange[0] && lat <= latRange[1] ? fromLonLat([lon, lat], projection) : null
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      current.push(p)
    } else if (current.length) {
      if (current.length > 1) out.push(current)
      current = []
    }
  }
  if (current.length > 1) out.push(current)
  return out
}

export interface S2GridResult {
  level: number
  lines: Coordinate[][]
}

/** Returns the S2 cell edges covering `extent`, in view coordinates. */
export function computeS2GridLines(
  extent: Extent,
  projection: ProjectionLike,
  projectionName: string,
  zoomAboveMin: number
): S2GridResult {
  const { visibleFraction, faces } = sampleView(extent, projection)
  const level = chooseS2Level(visibleFraction, zoomAboveMin)
  const cells = 2 ** level
  const latRange = getS2LatRange(projectionName)
  const lines: Coordinate[][] = []

  const addLine = (face: number, fixed: number, from: number, to: number, fixedIsS: boolean) => {
    const segments = Math.min(1024, Math.max(32, Math.ceil((to - from) * cells * 8)))
    const pts: [number, number][] = []
    const uvFixed = stToUV(fixed)
    for (let k = 0; k <= segments; k++) {
      const uvVar = stToUV(from + ((to - from) * k) / segments)
      const xyz = fixedIsS ? faceUVToXYZ(face, uvFixed, uvVar) : faceUVToXYZ(face, uvVar, uvFixed)
      pts.push(xyzToLonLat(xyz))
    }
    lines.push(...projectLine(pts, projection, latRange))
  }

  faces.forEach((b, face) => {
    if (!b) return
    // Pad by one cell so edges just outside the sampled points are still drawn.
    const s0 = Math.max(0, b.sMin - 1 / cells)
    const s1 = Math.min(1, b.sMax + 1 / cells)
    const t0 = Math.max(0, b.tMin - 1 / cells)
    const t1 = Math.min(1, b.tMax + 1 / cells)
    const kS0 = Math.ceil(s0 * cells)
    const kS1 = Math.floor(s1 * cells)
    const kT0 = Math.ceil(t0 * cells)
    const kT1 = Math.floor(t1 * cells)
    if (kS1 - kS0 > 512 || kT1 - kT0 > 512) return
    for (let k = kS0; k <= kS1; k++) addLine(face, k / cells, t0, t1, true)
    for (let k = kT0; k <= kT1; k++) addLine(face, k / cells, s0, s1, false)
  })

  return { level, lines }
}
