/**
 * Integration tests for JSON import/export round-trip
 *
 * These tests verify that importing a JSON request file and then generating
 * request parameters produces output that matches the original input.
 *
 * Flow: JSON file → applyParsedJsonToStores → store → getAtlxxReqParams → compare
 *
 * Note: CSS mocking is handled by tests/setup/unit.setup.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { applyParsedJsonToStores } from '@/utils/applyParsedJsonToStores'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRasterParamsStore } from '@/stores/rasterParamsStore'
import { calculatePolygonArea } from '@/composables/SrTurfUtils'

const testDataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')

function loadTestJson(filename: string): any {
  const filePath = path.join(testDataDir, filename)
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Compare two values, handling special cases like arrays and dates
 */
function compareValue(expected: any, actual: any, path: string): string[] {
  const errors: string[] = []

  if (expected === undefined || expected === null) {
    return errors // Skip undefined/null expected values
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      errors.push(`${path}: expected array, got ${typeof actual}`)
      return errors
    }
    // For arrays, check that all expected elements are present
    // (actual may have additional elements from defaults)
    for (let i = 0; i < expected.length; i++) {
      if (typeof expected[i] === 'object' && expected[i] !== null) {
        // For objects in arrays (like poly coordinates), compare deeply
        const found = actual.some((item: any) => {
          try {
            expect(item).toEqual(expected[i])
            return true
          } catch {
            return false
          }
        })
        if (!found && !actual.some((a: any) => JSON.stringify(a) === JSON.stringify(expected[i]))) {
          errors.push(`${path}[${i}]: expected element not found in array`)
        }
      } else {
        if (!actual.includes(expected[i])) {
          errors.push(`${path}: missing expected value ${expected[i]}`)
        }
      }
    }
  } else if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) {
      errors.push(`${path}: expected object, got ${typeof actual}`)
      return errors
    }
    // Recursively compare object properties
    for (const key of Object.keys(expected)) {
      errors.push(...compareValue(expected[key], actual[key], `${path}.${key}`))
    }
  } else {
    // Primitive comparison
    if (actual !== expected) {
      // Check for date string comparison
      if (typeof expected === 'string' && expected.includes('T') && expected.includes('Z')) {
        // It's a date string - compare as dates
        const expectedDate = new Date(expected).getTime()
        const actualDate = new Date(actual).getTime()
        if (expectedDate !== actualDate) {
          errors.push(`${path}: expected ${expected}, got ${actual}`)
        }
      } else {
        errors.push(`${path}: expected ${expected}, got ${actual}`)
      }
    }
  }

  return errors
}

/**
 * Compare input parameters against generated output
 * Only checks that input params are present in output (output may have additional defaults)
 */
function _compareParams(inputParms: any, outputParms: any): string[] {
  const errors: string[] = []

  for (const key of Object.keys(inputParms)) {
    errors.push(...compareValue(inputParms[key], outputParms[key], key))
  }

  return errors
}

describe('applyParsedJsonToStores - Round-trip Tests', () => {
  let reqParamsStore: ReturnType<typeof useReqParamsStore>
  let rasterParamsStore: ReturnType<typeof useRasterParamsStore>
  let importErrors: Array<{ section: string; message: string }>
  let addError: (_section: string, _message: string) => void

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia())
    reqParamsStore = useReqParamsStore()
    rasterParamsStore = useRasterParamsStore()

    // Reset stores to default state
    reqParamsStore.reset()
    rasterParamsStore.$reset()

    // Track import errors
    importErrors = []
    addError = (section, message) => importErrors.push({ section, message })
  })

  describe('Test data file accessibility', () => {
    const apiFiles = [
      'atl03x.json',
      'atl03x-surface.json',
      'atl03x-phoreal.json',
      'atl03vp.json',
      'atl06.json',
      'atl06p.json',
      'atl06sp.json',
      'atl08.json',
      'atl08p.json',
      'atl13x.json',
      'atl24x.json',
      'gedi01bp.json',
      'gedi02ap.json',
      'gedi04ap.json'
    ]

    apiFiles.forEach((filename) => {
      it(`should have ${filename} test file available`, () => {
        const testFilePath = path.join(testDataDir, filename)
        expect(fs.existsSync(testFilePath)).toBe(true)
      })
    })
  })

  describe('ICESat-2 API round-trip tests', () => {
    it('atl03x: should preserve srt, cnf, atl03_geo_fields, and time range', () => {
      const input = loadTestJson('atl03x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      // Set the API to match expected output structure
      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify specific parameters are preserved
      expect(output.parms.srt).toEqual(expect.arrayContaining([0]))
      expect(output.parms.cnf).toEqual(expect.arrayContaining([4, 3, 2]))
      expect(output.parms.atl03_geo_fields).toEqual(['solar_elevation'])
      expect(output.parms.t0).toBeDefined()
      expect(output.parms.t1).toBeDefined()
      expect(importErrors).toHaveLength(0)
    })

    it('atl03x-surface: should preserve fit parameters (maxi, h_win, sigma_r)', () => {
      const input = loadTestJson('atl03x-surface.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-surface')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify fit parameters
      expect(output.parms.fit).toBeDefined()
      expect(output.parms.fit.maxi).toBe(6)
      expect(output.parms.fit.h_win).toBe(3.0)
      expect(output.parms.fit.sigma_r).toBe(5.0)

      // Verify length/step parameters
      expect(output.parms.len).toBe(40.0)
      expect(output.parms.res).toBe(20.0)
      expect(output.parms.cnt).toBe(10)
      expect(output.parms.ats).toBe(10.0)

      expect(importErrors).toHaveLength(0)
    })

    it('atl03x-phoreal: should preserve phoreal sub-parameters', () => {
      const input = loadTestJson('atl03x-phoreal.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-phoreal')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify phoreal parameters
      expect(output.parms.phoreal).toBeDefined()
      expect(output.parms.phoreal!.geoloc).toBe('mean')
      expect(output.parms.phoreal!.binsize).toBe(1.0)
      expect(output.parms.phoreal!.above_classifier).toBe(true)
      expect(output.parms.phoreal!.use_abs_h).toBe(true)

      expect(importErrors).toHaveLength(0)
    })

    it('atl03vp: should preserve quality_ph parameter', () => {
      const input = loadTestJson('atl03vp.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03vp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify quality_ph is preserved
      expect(output.parms.quality_ph).toEqual(expect.arrayContaining([0, 1, 2, 3]))

      expect(importErrors).toHaveLength(0)
    })

    it('atl06sp: should preserve rgt and cycle parameters', () => {
      const input = loadTestJson('atl06sp.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl06sp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify granule selection parameters
      expect(output.parms.rgt).toBe(1234)
      expect(output.parms.cycle).toBe(10)

      expect(importErrors).toHaveLength(0)
    })

    it('atl06p: should preserve fit, atl08_class, and field arrays', () => {
      const input = loadTestJson('atl06p.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl06p')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify fit is enabled
      expect(output.parms.fit).toBeDefined()
      expect(output.parms.fit.maxi).toBe(6)

      // Verify atl08_class
      expect(output.parms.atl08_class).toEqual(expect.arrayContaining(['atl08_ground']))

      // Verify field arrays
      expect(output.parms.atl06_fields).toEqual(['ground_track/ref_azimuth'])

      expect(importErrors).toHaveLength(0)
    })

    it('atl08p: should preserve phoreal with send_waveform and atl08_fields', () => {
      const input = loadTestJson('atl08p.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl08p')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify phoreal with send_waveform
      expect(output.parms.phoreal).toBeDefined()
      expect(output.parms.phoreal!.binsize).toBe(1.0)
      expect(output.parms.phoreal!.send_waveform).toBe(true)

      // Verify atl08_fields
      expect(output.parms.atl08_fields).toEqual(
        expect.arrayContaining(['segment_snowcover', 'segment_landcover'])
      )

      expect(importErrors).toHaveLength(0)
    })

    it('atl13x: should preserve atl13 coord and atl13_fields', () => {
      const input = loadTestJson('atl13x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl13x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify atl13 parameters
      expect(output.parms.atl13).toBeDefined()
      expect(output.parms.atl13.coord).toEqual({ lon: -108.025, lat: 39.025 })

      // Verify atl13_fields
      expect(output.parms.atl13_fields).toEqual(['ht_ortho'])

      expect(importErrors).toHaveLength(0)
    })

    it('atl24x: should preserve atl24 parameters and datum', () => {
      const input = loadTestJson('atl24x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify atl24 parameters
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.compact).toBe(true)
      expect(output.parms.atl24.class_ph).toEqual(expect.arrayContaining(['bathymetry']))
      expect(output.parms.atl24.confidence_threshold).toBe(0.6)

      // Verify datum
      expect(output.parms.datum).toBe('EGM08')

      expect(importErrors).toHaveLength(0)
    })
  })

  describe('GEDI API round-trip tests', () => {
    it('gedi01bp: should preserve degrade_filter, beams, gedi_fields, and resources', () => {
      const input = loadTestJson('gedi01bp.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      // Resources are at top level, not inside parms, so set them directly
      if (input.resources) {
        reqParamsStore.resources = input.resources
      }

      reqParamsStore.setMissionValue('GEDI')
      reqParamsStore.setGediAPI('gedi01bp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify GEDI flags
      expect(output.parms.degrade_filter).toBe(true)

      // Verify GEDI beams: input beams=0 means all beams
      // Export should also be 0 for all beams
      expect(output.parms.beams).toBe(0)

      // Verify gedi_fields is exported
      expect(output.parms.gedi_fields).toEqual(['elevation_bin0'])

      // Verify resources
      expect(output.resources).toEqual(['GEDI01_B_2019108002012_O01959_T03909_02_003_01_V002.h5'])

      expect(importErrors).toHaveLength(0)
    })

    it('gedi02ap: should preserve degrade_filter, l2_quality_filter, and gedi_fields', () => {
      const input = loadTestJson('gedi02ap.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('GEDI')
      reqParamsStore.setGediAPI('gedi02ap')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify GEDI quality flags
      expect(output.parms.degrade_filter).toBe(true)
      expect(output.parms.l2_quality_filter).toBe(true)

      // Verify gedi_fields is exported
      expect(output.parms.gedi_fields).toEqual(['elev_lowestmode'])

      // Verify beams (all beams = 0)
      expect(output.parms.beams).toBe(0)

      expect(importErrors).toHaveLength(0)
    })

    it('gedi04ap: should preserve all GEDI quality flags and gedi_fields', () => {
      const input = loadTestJson('gedi04ap.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('GEDI')
      reqParamsStore.setGediAPI('gedi04ap')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify all GEDI quality flags
      expect(output.parms.degrade_filter).toBe(true)
      expect(output.parms.l2_quality_filter).toBe(true)
      expect(output.parms.l4_quality_filter).toBe(true)
      expect(output.parms.surface_flag).toBe(true)

      // Verify gedi_fields is exported
      expect(output.parms.gedi_fields).toEqual(['agbd'])

      // Verify beams (all beams = 0)
      expect(output.parms.beams).toBe(0)

      expect(importErrors).toHaveLength(0)
    })
  })

  describe('Polygon preservation tests', () => {
    it('should preserve polygon through import and store it correctly', () => {
      const input = loadTestJson('atl03x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x')

      // Verify polygon is stored in the store
      expect(reqParamsStore.poly).toBeDefined()
      expect(Array.isArray(reqParamsStore.poly)).toBe(true)
      expect(reqParamsStore.poly!.length).toBe(input.parms.poly.length)

      // Check each coordinate pair in the store's poly
      for (let i = 0; i < input.parms.poly.length; i++) {
        expect(reqParamsStore.poly![i].lon).toBeCloseTo(input.parms.poly[i].lon, 5)
        expect(reqParamsStore.poly![i].lat).toBeCloseTo(input.parms.poly[i].lat, 5)
      }

      // Note: getAtlxxReqParams exports convexHull by default (when rasterize is disabled)
      // The convexHull is computed from the polygon and may have different coordinates
      const output = reqParamsStore.getAtlxxReqParams(0)
      expect(output.parms.poly).toBeDefined()
      expect(Array.isArray(output.parms.poly)).toBe(true)

      expect(importErrors).toHaveLength(0)
    })

    it('should export convexHull with area >= original poly area', () => {
      const input = loadTestJson('atl03x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify polygons exist
      expect(output.parms.poly).toBeDefined()
      expect(Array.isArray(output.parms.poly)).toBe(true)

      // Calculate areas
      const inputPolyArea = calculatePolygonArea(input.parms.poly)
      const outputPolyArea = calculatePolygonArea(output.parms.poly!)

      // ConvexHull area should be >= original poly area
      // (convex hull always contains the original polygon)
      expect(outputPolyArea).toBeGreaterThanOrEqual(inputPolyArea * 0.99) // Allow 1% tolerance for floating point

      expect(importErrors).toHaveLength(0)
    })

    it('should export polygon with correct winding direction (counter-clockwise)', () => {
      const input = loadTestJson('atl03x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify polygon exists
      expect(output.parms.poly).toBeDefined()
      expect(Array.isArray(output.parms.poly)).toBe(true)

      const poly = output.parms.poly!

      // Calculate signed area to determine winding direction
      // Positive = counter-clockwise (correct for GeoJSON exterior rings)
      // Negative = clockwise
      let signedArea = 0
      for (let i = 0; i < poly.length - 1; i++) {
        const j = (i + 1) % poly.length
        signedArea += (poly[j].lon - poly[i].lon) * (poly[j].lat + poly[i].lat)
      }

      // For geographic coordinates, negative signed area = counter-clockwise
      // (because latitude increases northward, opposite of screen coordinates)
      expect(signedArea).toBeLessThanOrEqual(0)

      expect(importErrors).toHaveLength(0)
    })
  })

  describe('Legacy parameter name conversion', () => {
    it('should convert legacy degrade to degrade_filter with warning', () => {
      const legacyInput = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        degrade: true // Legacy name
      }

      applyParsedJsonToStores(legacyInput, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('GEDI')
      reqParamsStore.setGediAPI('gedi01bp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Should be converted to degrade_filter
      expect(output.parms.degrade_filter).toBe(true)

      // Should have a warning about legacy name
      expect(importErrors.some((e) => e.section === 'degrade')).toBe(true)
    })

    it('should convert legacy fit.H_min_win to h_win with warning', () => {
      const legacyInput = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        fit: {
          H_min_win: 3.0 // Legacy name
        }
      }

      applyParsedJsonToStores(legacyInput, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-surface')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Should be converted to h_win
      expect(output.parms.fit.h_win).toBe(3.0)

      // Should have a warning about legacy name
      expect(importErrors.some((e) => e.section === 'fit.H_min_win')).toBe(true)
    })

    it('should convert legacy fit.sigma_r_max to sigma_r with warning', () => {
      const legacyInput = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        fit: {
          sigma_r_max: 5.0 // Legacy name
        }
      }

      applyParsedJsonToStores(legacyInput, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-surface')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Should be converted to sigma_r
      expect(output.parms.fit.sigma_r).toBe(5.0)

      // Should have a warning about legacy name
      expect(importErrors.some((e) => e.section === 'fit.sigma_r_max')).toBe(true)
    })
  })

  describe('Resources handling', () => {
    it('should preserve resources array for GEDI requests', () => {
      const input = loadTestJson('gedi01bp.json')

      // Apply parms
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      // Also set resources if present at top level
      if (input.resources) {
        reqParamsStore.resources = input.resources
      }

      reqParamsStore.setMissionValue('GEDI')
      reqParamsStore.setGediAPI('gedi01bp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      expect(output.resources).toEqual(input.resources)
    })
  })
})
