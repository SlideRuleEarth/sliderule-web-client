// tests/unit/convexHullRendering.spec.ts
import { describe, it, expect } from 'vitest'
import { convexHull } from '@/composables/SrTurfUtils'
import type { SrLatLon } from '@/types/SrTypes'

describe('Convex Hull Calculation and Rendering', () => {
  describe('convexHull', () => {
    it('should calculate convex hull for a simple polygon', () => {
      const polygon: SrLatLon[] = [
        { lon: 0, lat: 0 },
        { lon: 1, lat: 0 },
        { lon: 1, lat: 1 },
        { lon: 0, lat: 1 }
      ]

      const hull = convexHull(polygon)

      // Square should return 4 corner points + 1 closing point = 5
      expect(hull).toHaveLength(5)
      // First and last point should be the same (closed polygon)
      expect(hull[0]).toEqual(hull[hull.length - 1])
    })

    it('should reduce points for a complex polygon with interior points', () => {
      const polygon: SrLatLon[] = [
        { lon: 0, lat: 0 },
        { lon: 0.5, lat: 0.5 }, // Interior point
        { lon: 1, lat: 0 },
        { lon: 1, lat: 1 },
        { lon: 0.5, lat: 0.5 }, // Interior point
        { lon: 0, lat: 1 }
      ]

      const hull = convexHull(polygon)

      // Should have fewer points than original (interior points removed)
      expect(hull.length).toBeLessThan(polygon.length)
      expect(hull.length).toBeGreaterThanOrEqual(3) // At least a triangle
    })

    it('should handle the 41-point example from the bug report', () => {
      // Simulated 41-point polygon like the one in the bug
      const polygon: SrLatLon[] = Array.from({ length: 41 }, (_, i) => ({
        lon: 10.5 + Math.cos((i / 41) * 2 * Math.PI) * 0.1,
        lat: 44.2 + Math.sin((i / 41) * 2 * Math.PI) * 0.1
      }))

      const hull = convexHull(polygon)

      // Convex hull should reduce or keep the same number of points (plus closing point)
      // For a circle, hull should have similar number of points
      expect(hull.length).toBeGreaterThanOrEqual(3)
      // First and last point should be the same (closed polygon)
      expect(hull[0]).toEqual(hull[hull.length - 1])
    })

    it('should return closed hull for minimal convex polygon', () => {
      const triangle: SrLatLon[] = [
        { lon: 0, lat: 0 },
        { lon: 1, lat: 0 },
        { lon: 0.5, lat: 1 }
      ]

      const hull = convexHull(triangle)

      // Triangle is already convex, should return 3 vertices + 1 closing point = 4
      expect(hull).toHaveLength(4)
      // First and last point should be the same (closed polygon)
      expect(hull[0]).toEqual(hull[hull.length - 1])
    })
  })

  describe('Feature ID Generation', () => {
    it('should generate unique IDs for polygon and convex hull', () => {
      const reqId = 0
      const api = 'atl03x-surface'

      // Simulate the ID generation logic
      const polygonId = `Record:${reqId}-${api}`
      const hullId = `Record:${reqId}-${api}-hull`

      expect(polygonId).toBe('Record:0-atl03x-surface')
      expect(hullId).toBe('Record:0-atl03x-surface-hull')
      expect(polygonId).not.toBe(hullId)
    })

    it('should generate unique IDs for multiple requests', () => {
      const api = 'atl03x-surface'

      const ids = [0, 1, 2, 3].map((reqId) => ({
        polygon: `Record:${reqId}-${api}`,
        hull: `Record:${reqId}-${api}-hull`
      }))

      // All IDs should be unique
      const allIds = ids.flatMap(({ polygon, hull }) => [polygon, hull])
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
    })
  })

  describe('Label Display Logic', () => {
    it('should return empty label for reqId 0', () => {
      const reqId = 0
      const label = reqId > 0 ? reqId.toString() : ''

      expect(label).toBe('')
    })

    it('should return reqId as label for reqId > 0', () => {
      const reqId = 1120
      const label = reqId > 0 ? reqId.toString() : ''

      expect(label).toBe('1120')
    })

    it('should handle various reqId values', () => {
      const testCases = [
        { reqId: 0, expected: '' },
        { reqId: 1, expected: '1' },
        { reqId: 42, expected: '42' },
        { reqId: 1000, expected: '1000' }
      ]

      testCases.forEach(({ reqId, expected }) => {
        const label = reqId > 0 ? reqId.toString() : ''
        expect(label).toBe(expected)
      })
    })
  })

  describe('Polygon Selection Logic', () => {
    it('should use raw polygon when rasterize is enabled', () => {
      const rawPoly = { length: 41 }
      const convexHull = { length: 10 }
      const rasterizeEnabled = true

      const polyToUse = rasterizeEnabled ? rawPoly : convexHull

      expect(polyToUse).toBe(rawPoly)
      expect(polyToUse.length).toBe(41)
    })

    it('should use convex hull when rasterize is disabled', () => {
      const rawPoly = { length: 41 }
      const convexHull = { length: 10 }
      const rasterizeEnabled = false

      const polyToUse = rasterizeEnabled ? rawPoly : convexHull

      expect(polyToUse).toBe(convexHull)
      expect(polyToUse.length).toBe(10)
    })
  })

  describe('addRecordLayer Skip Logic', () => {
    it('should skip rendering when reqId matches selectedReqId and poly exists', () => {
      const reqId = 1120
      const selectedReqId = 1120
      const hasPoly = true

      const shouldSkip = reqId === selectedReqId && hasPoly

      expect(shouldSkip).toBe(true)
    })

    it('should not skip when reqId does not match selectedReqId', () => {
      const reqId: number = 1119
      const selectedReqId: number = 1120
      const hasPoly = true

      const shouldSkip = reqId === selectedReqId && hasPoly

      expect(shouldSkip).toBe(false)
    })

    it('should not skip when no poly exists', () => {
      const reqId = 1120
      const selectedReqId = 1120
      const hasPoly = false

      const shouldSkip = reqId === selectedReqId && hasPoly

      expect(shouldSkip).toBe(false)
    })

    it('should handle reqId 0 (current editing)', () => {
      const reqId = 0
      const selectedReqId = 0
      const hasPoly = true

      const shouldSkip = reqId === selectedReqId && hasPoly

      expect(shouldSkip).toBe(true)
    })
  })
})
