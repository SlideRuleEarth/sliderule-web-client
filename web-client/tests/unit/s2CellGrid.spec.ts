import { describe, it, expect } from 'vitest'
import {
  chooseS2Level,
  computeS2GridLines,
  faceUVToXYZ,
  lonLatToXYZ,
  stToUV,
  uvToST,
  xyzToFaceUV,
  xyzToLonLat
} from '@/utils/s2CellGrid'

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
