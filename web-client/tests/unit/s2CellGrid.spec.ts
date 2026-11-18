import { describe, it, expect } from 'vitest'
import {
  cellIdToFaceIJ,
  chooseS2Level,
  computeS2GridLines,
  faceIJToCellIdHex,
  faceUVToXYZ,
  lonLatToFaceST,
  lonLatToXYZ,
  stToUV,
  uvToST,
  xyzToFaceUV,
  xyzToLonLat
} from '@/utils/s2CellGrid'

// [stat cell id, lon_mean, lat_mean] from atl06tv4/stats files at file levels 0, 7 and 3
const STAT_CELLS: [string, number, number][] = [
  ['4ED2C00000000000', -30.378755, 64.799592],
  ['4EFA400000000000', -46.709463, 72.171972],
  ['4DD7C00000000000', -71.376968, 65.873781],
  ['452AD49900000000', 89.873739, 80.017107],
  ['452AD4A100000000', 89.917209, 80.01264],
  ['452AD58F00000000', 89.730898, 80.090788],
  ['4C32A30000000000', -68.235214, 62.490257],
  ['4C2C790000000000', -65.670833, 63.755075],
  ['4C2C530000000000', -66.323515, 63.16728]
]

function levelOf(hex: string): number {
  const id = BigInt('0x' + hex)
  let lsb = 0
  while (((id >> BigInt(lsb)) & 1n) === 0n) lsb++
  return 30 - lsb / 2
}

describe('s2CellGrid', () => {
  it('round-trips ST <-> UV', () => {
    for (const s of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(uvToST(stToUV(s))).toBeCloseTo(s, 12)
    }
  })

  it('places face centers on the expected axes', () => {
    const centers: [number, number][] = [
      [0, 0],
      [90, 0],
      [0, 90],
      [180, 0],
      [-90, 0],
      [0, -90]
    ]
    centers.forEach(([lon, lat], face) => {
      const [f, u, v] = xyzToFaceUV(lonLatToXYZ(lon, lat))
      expect(f).toBe(face)
      expect(u).toBeCloseTo(0, 12)
      expect(v).toBeCloseTo(0, 12)
    })
  })

  it('round-trips face/UV <-> xyz on every face', () => {
    for (let face = 0; face < 6; face++) {
      const [f, u, v] = xyzToFaceUV(faceUVToXYZ(face, 0.3, -0.6))
      expect(f).toBe(face)
      expect(u).toBeCloseTo(0.3, 12)
      expect(v).toBeCloseTo(-0.6, 12)
    }
  })

  it('level-0 cell corner is at the cube vertex', () => {
    const [lon, lat] = xyzToLonLat(faceUVToXYZ(0, 1, 1))
    expect(lon).toBeCloseTo(45, 9)
    expect(lat).toBeCloseTo((Math.atan(1 / Math.SQRT2) * 180) / Math.PI, 9)
  })

  it('chooses level 0 at min zoom and keeps a few hundred cells when zoomed in', () => {
    expect(chooseS2Level(1, 0)).toBe(0)
    expect(chooseS2Level(0.25, 1)).toBe(1)
    const frac = 1e-6
    const level = chooseS2Level(frac, 20)
    const visible = 6 * 4 ** level * frac
    expect(visible).toBeGreaterThan(100)
    expect(visible).toBeLessThan(1000)
  })

  it('decodes stat cell ids to the cell containing their mean position', () => {
    const faceIJ = new Int32Array(3)
    const st = new Float64Array(2)
    for (const [hex, lon, lat] of STAT_CELLS) {
      const level = levelOf(hex)
      const id = BigInt('0x' + hex)
      cellIdToFaceIJ(Number(id >> 32n), Number(id & 0xffffffffn), level, faceIJ)
      const face = lonLatToFaceST(lon, lat, st)
      const n = 2 ** level
      expect([faceIJ[0], faceIJ[1], faceIJ[2]]).toEqual([
        face,
        Math.floor(st[0] * n),
        Math.floor(st[1] * n)
      ])
      expect(faceIJToCellIdHex(faceIJ[0], faceIJ[1], faceIJ[2], level)).toBe(hex)
    }
  })

  it('encodes level-0 face cells', () => {
    expect(faceIJToCellIdHex(0, 0, 0, 0)).toBe('1000000000000000')
    expect(faceIJToCellIdHex(2, 0, 0, 0)).toBe('5000000000000000')
    expect(faceIJToCellIdHex(5, 0, 0, 0)).toBe('B000000000000000')
  })

  it('computes level-0 edges for a whole-world mercator view', () => {
    const half = 20037508.34
    const { level, lines } = computeS2GridLines(
      [-half, -half, half, half],
      'EPSG:3857',
      'EPSG:3857',
      0
    )
    expect(level).toBe(0)
    expect(lines.length).toBeGreaterThanOrEqual(12)
    lines.flat().forEach(([x, y]) => {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    })
  })

  it('picks a finer level for a small zoomed-in view', () => {
    const { level, lines } = computeS2GridLines(
      [0, 0, 100000, 100000],
      'EPSG:3857',
      'EPSG:3857',
      10
    )
    expect(level).toBeGreaterThan(5)
    expect(lines.length).toBeGreaterThan(10)
    expect(lines.length).toBeLessThan(200)
  })
})
