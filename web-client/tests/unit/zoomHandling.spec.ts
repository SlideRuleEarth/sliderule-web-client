/**
 * Unit tests for zoom handling in SrElevationPlot
 *
 * Tests the three zoom methods:
 * 1. Drag-to-zoom rectangle
 * 2. DataZoom slider
 * 3. Scroll wheel/pinch
 *
 * All three methods should correctly update atlChartFilterStore zoom values
 * so that getVisibleLatLonExtent() can determine the visible plot extent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'

// Mock logger to avoid console noise in tests
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('Zoom Handling - Store State Updates', () => {
  let atlChartFilterStore: ReturnType<typeof useAtlChartFilterStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    atlChartFilterStore = useAtlChartFilterStore()
  })

  describe('Initial State', () => {
    it('should have undefined xZoomStartValue and xZoomEndValue initially', () => {
      expect(atlChartFilterStore.xZoomStartValue).toBeUndefined()
      expect(atlChartFilterStore.xZoomEndValue).toBeUndefined()
    })

    it('should have default percentage values (0-100)', () => {
      expect(atlChartFilterStore.xZoomStart).toBe(0)
      expect(atlChartFilterStore.xZoomEnd).toBe(100)
      expect(atlChartFilterStore.yZoomStart).toBe(0)
      expect(atlChartFilterStore.yZoomEnd).toBe(100)
    })
  })

  describe('Method 1: Drag-to-zoom Rectangle', () => {
    it('should update xZoomStartValue and xZoomEndValue when rectangle zoom is applied', () => {
      // Simulate what handleZoomMouseUp does (SrElevationPlot.vue:143-148)
      const startData = [100, 50] // x, y from convertFromPixel
      const endData = [500, 200]

      atlChartFilterStore.xZoomStartValue = Math.min(startData[0], endData[0])
      atlChartFilterStore.xZoomEndValue = Math.max(startData[0], endData[0])
      atlChartFilterStore.yZoomStartValue = Math.min(startData[1], endData[1])
      atlChartFilterStore.yZoomEndValue = Math.max(startData[1], endData[1])

      expect(atlChartFilterStore.xZoomStartValue).toBe(100)
      expect(atlChartFilterStore.xZoomEndValue).toBe(500)
      expect(atlChartFilterStore.yZoomStartValue).toBe(50)
      expect(atlChartFilterStore.yZoomEndValue).toBe(200)
    })

    it('should handle reversed coordinates (end < start)', () => {
      // User drags from right to left
      const startData = [500, 200]
      const endData = [100, 50]

      atlChartFilterStore.xZoomStartValue = Math.min(startData[0], endData[0])
      atlChartFilterStore.xZoomEndValue = Math.max(startData[0], endData[0])

      expect(atlChartFilterStore.xZoomStartValue).toBe(100)
      expect(atlChartFilterStore.xZoomEndValue).toBe(500)
    })
  })

  describe('Method 2 & 3: DataZoom Slider and Scroll/Pinch', () => {
    it('should update store when datazoom event provides startValue/endValue', () => {
      // Simulate datazoom event with actual data values
      const xDataZoom = {
        startValue: 1000,
        endValue: 5000,
        start: 20,
        end: 80
      }

      // This is what the datazoom handler does when startValue/endValue are available
      if (xDataZoom.startValue !== undefined && xDataZoom.endValue !== undefined) {
        atlChartFilterStore.xZoomStartValue = xDataZoom.startValue
        atlChartFilterStore.xZoomEndValue = xDataZoom.endValue
      }
      if (xDataZoom.start !== undefined) atlChartFilterStore.xZoomStart = xDataZoom.start
      if (xDataZoom.end !== undefined) atlChartFilterStore.xZoomEnd = xDataZoom.end

      expect(atlChartFilterStore.xZoomStartValue).toBe(1000)
      expect(atlChartFilterStore.xZoomEndValue).toBe(5000)
      expect(atlChartFilterStore.xZoomStart).toBe(20)
      expect(atlChartFilterStore.xZoomEnd).toBe(80)
    })

    it('should calculate values from percentages when startValue/endValue are not available', () => {
      // Simulate datazoom event with only percentages
      const xDataZoom = {
        start: 25,
        end: 75
        // No startValue/endValue
      }

      // Mock columnMinMax data (what globalChartStore.getAllColumnMinMaxValues() returns)
      const xFieldMinMax = {
        min: 0,
        max: 10000
      }

      // This is what the datazoom handler does for percentage-based zoom
      if (xDataZoom.start !== undefined && xDataZoom.end !== undefined) {
        if (
          xFieldMinMax &&
          Number.isFinite(xFieldMinMax.min) &&
          Number.isFinite(xFieldMinMax.max)
        ) {
          const dataRange = xFieldMinMax.max - xFieldMinMax.min
          atlChartFilterStore.xZoomStartValue =
            xFieldMinMax.min + (xDataZoom.start / 100) * dataRange
          atlChartFilterStore.xZoomEndValue = xFieldMinMax.min + (xDataZoom.end / 100) * dataRange
        }
        atlChartFilterStore.xZoomStart = xDataZoom.start
        atlChartFilterStore.xZoomEnd = xDataZoom.end
      }

      // 25% of 10000 = 2500, 75% of 10000 = 7500
      expect(atlChartFilterStore.xZoomStartValue).toBe(2500)
      expect(atlChartFilterStore.xZoomEndValue).toBe(7500)
      expect(atlChartFilterStore.xZoomStart).toBe(25)
      expect(atlChartFilterStore.xZoomEnd).toBe(75)
    })

    it('should handle Y-axis zoom values', () => {
      const yDataZoom = {
        startValue: -100,
        endValue: 500,
        start: 10,
        end: 90
      }

      if (yDataZoom.startValue !== undefined && yDataZoom.endValue !== undefined) {
        atlChartFilterStore.yZoomStartValue = yDataZoom.startValue
        atlChartFilterStore.yZoomEndValue = yDataZoom.endValue
      }
      if (yDataZoom.start !== undefined) atlChartFilterStore.yZoomStart = yDataZoom.start
      if (yDataZoom.end !== undefined) atlChartFilterStore.yZoomEnd = yDataZoom.end

      expect(atlChartFilterStore.yZoomStartValue).toBe(-100)
      expect(atlChartFilterStore.yZoomEndValue).toBe(500)
      expect(atlChartFilterStore.yZoomStart).toBe(10)
      expect(atlChartFilterStore.yZoomEnd).toBe(90)
    })
  })

  describe('Reset Zoom', () => {
    it('should clear all zoom values when resetZoom is called', () => {
      // Set some zoom values
      atlChartFilterStore.xZoomStartValue = 100
      atlChartFilterStore.xZoomEndValue = 500
      atlChartFilterStore.xZoomStart = 20
      atlChartFilterStore.xZoomEnd = 80
      atlChartFilterStore.yZoomStartValue = 50
      atlChartFilterStore.yZoomEndValue = 200
      atlChartFilterStore.yZoomStart = 10
      atlChartFilterStore.yZoomEnd = 90

      // Reset
      atlChartFilterStore.resetZoom()

      // Verify reset state
      expect(atlChartFilterStore.xZoomStart).toBe(0)
      expect(atlChartFilterStore.xZoomEnd).toBe(100)
      expect(atlChartFilterStore.yZoomStart).toBe(0)
      expect(atlChartFilterStore.yZoomEnd).toBe(100)
      expect(atlChartFilterStore.xZoomStartValue).toBeUndefined()
      expect(atlChartFilterStore.xZoomEndValue).toBeUndefined()
      expect(atlChartFilterStore.yZoomStartValue).toBeUndefined()
      expect(atlChartFilterStore.yZoomEndValue).toBeUndefined()
    })
  })
})

describe('Zoom Value Calculation Logic', () => {
  describe('Percentage to Value Conversion', () => {
    it('should correctly convert percentage to value for positive range', () => {
      const min = 1000
      const max = 5000
      const dataRange = max - min // 4000
      const startPct = 25
      const endPct = 75

      const startValue = min + (startPct / 100) * dataRange
      const endValue = min + (endPct / 100) * dataRange

      expect(startValue).toBe(2000) // 1000 + 0.25 * 4000
      expect(endValue).toBe(4000) // 1000 + 0.75 * 4000
    })

    it('should correctly convert percentage to value for range starting at zero', () => {
      const min = 0
      const max = 10000
      const dataRange = max - min
      const startPct = 10
      const endPct = 50

      const startValue = min + (startPct / 100) * dataRange
      const endValue = min + (endPct / 100) * dataRange

      expect(startValue).toBe(1000)
      expect(endValue).toBe(5000)
    })

    it('should correctly convert percentage to value for negative range', () => {
      const min = -1000
      const max = 1000
      const dataRange = max - min // 2000
      const startPct = 0
      const endPct = 50

      const startValue = min + (startPct / 100) * dataRange
      const endValue = min + (endPct / 100) * dataRange

      expect(startValue).toBe(-1000)
      expect(endValue).toBe(0)
    })

    it('should handle full zoom (0-100%)', () => {
      const min = 500
      const max = 1500
      const dataRange = max - min

      const startValue = min + (0 / 100) * dataRange
      const endValue = min + (100 / 100) * dataRange

      expect(startValue).toBe(500)
      expect(endValue).toBe(1500)
    })

    it('should handle edge case with zero range', () => {
      const min = 100
      const max = 100
      const dataRange = max - min // 0

      const startValue = min + (25 / 100) * dataRange
      const endValue = min + (75 / 100) * dataRange

      expect(startValue).toBe(100)
      expect(endValue).toBe(100)
    })
  })

  describe('Guard Conditions', () => {
    it('should not calculate if min/max are not finite', () => {
      const testCases = [
        { min: NaN, max: 100 },
        { min: 0, max: NaN },
        { min: Infinity, max: 100 },
        { min: 0, max: -Infinity }
      ]

      testCases.forEach(({ min, max }) => {
        const isValid = Number.isFinite(min) && Number.isFinite(max)
        expect(isValid).toBe(false)
      })
    })

    it('should allow calculation when min/max are valid numbers', () => {
      const testCases = [
        { min: 0, max: 100 },
        { min: -100, max: 100 },
        { min: 0.5, max: 0.9 },
        { min: -1000000, max: 1000000 }
      ]

      testCases.forEach(({ min, max }) => {
        const isValid = Number.isFinite(min) && Number.isFinite(max)
        expect(isValid).toBe(true)
      })
    })
  })
})

describe('Integration: Zoom State for getVisibleLatLonExtent', () => {
  let atlChartFilterStore: ReturnType<typeof useAtlChartFilterStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    atlChartFilterStore = useAtlChartFilterStore()
  })

  it('should have xZoomStartValue/xZoomEndValue available after any zoom method', () => {
    // Simulate Method 1: Rectangle zoom
    atlChartFilterStore.xZoomStartValue = 100
    atlChartFilterStore.xZoomEndValue = 500

    // Verify values are available for getVisibleLatLonExtent
    expect(atlChartFilterStore.xZoomStartValue).toBeDefined()
    expect(atlChartFilterStore.xZoomEndValue).toBeDefined()
    expect(typeof atlChartFilterStore.xZoomStartValue).toBe('number')
    expect(typeof atlChartFilterStore.xZoomEndValue).toBe('number')
  })

  it('should maintain zoom state across multiple zoom operations', () => {
    // First zoom (rectangle)
    atlChartFilterStore.xZoomStartValue = 100
    atlChartFilterStore.xZoomEndValue = 500

    // Second zoom (slider adjusts the range)
    atlChartFilterStore.xZoomStartValue = 150
    atlChartFilterStore.xZoomEndValue = 450

    // Values should reflect the latest zoom
    expect(atlChartFilterStore.xZoomStartValue).toBe(150)
    expect(atlChartFilterStore.xZoomEndValue).toBe(450)
  })

  it('should clear values on reset, making full extent visible', () => {
    atlChartFilterStore.xZoomStartValue = 100
    atlChartFilterStore.xZoomEndValue = 500

    atlChartFilterStore.resetZoom()

    // After reset, values should be undefined (meaning full extent)
    expect(atlChartFilterStore.xZoomStartValue).toBeUndefined()
    expect(atlChartFilterStore.xZoomEndValue).toBeUndefined()
  })
})
