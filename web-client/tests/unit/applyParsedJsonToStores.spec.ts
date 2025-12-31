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
 * Filter out informational warnings from import errors.
 * These warnings are expected messages about:
 * - Polygon transformation (winding direction, starting point, convex hull)
 * - Type conversions (numeric to string names, string to numbers)
 */
function getNonPolygonErrors(
  errors: Array<{ section: string; message: string }>
): Array<{ section: string; message: string }> {
  return errors.filter((e) => {
    const msg = e.message.toLowerCase()
    // Exclude polygon adjustments
    if (e.section === 'poly') return false
    // Exclude type conversions (ADJUSTED category)
    if (msg.includes('converted to')) return false
    // Exclude API mismatch warnings (informational, not errors)
    if (msg.includes('only exported for') || msg.includes('will be missing')) return false
    return true
  })
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
      'atl24x-string.json',
      'atl24x-strings.json',
      'atl24x-number.json',
      'atl24x-numbers.json',
      'atl24x-legacy.json',
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
      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl03vp: should preserve quality_ph parameter', () => {
      const input = loadTestJson('atl03vp.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03vp')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify quality_ph is preserved
      expect(output.parms.quality_ph).toEqual(expect.arrayContaining([0, 1, 2, 3]))

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl24x-string: should import class_ph with single string value', () => {
      const input = loadTestJson('atl24x-string.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify single string class_ph ["bathymetry"]
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.class_ph).toEqual(expect.arrayContaining(['bathymetry']))
      expect(output.parms.atl24.class_ph).toHaveLength(1)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl24x-strings: should import class_ph with multiple string values', () => {
      const input = loadTestJson('atl24x-strings.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify multiple string class_ph ["bathymetry", "sea_surface"]
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.compact).toBe(true)
      expect(output.parms.atl24.class_ph).toEqual(
        expect.arrayContaining(['bathymetry', 'sea_surface'])
      )
      expect(output.parms.atl24.class_ph).toHaveLength(2)
      expect(output.parms.atl24.confidence_threshold).toBe(0.6)

      // Verify datum
      expect(output.parms.datum).toBe('EGM08')

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl24x-number: should import class_ph with single numeric value', () => {
      const input = loadTestJson('atl24x-number.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify single numeric class_ph [40] was converted to string ['bathymetry']
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.class_ph).toEqual(expect.arrayContaining(['bathymetry']))
      expect(output.parms.atl24.class_ph).toHaveLength(1)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl24x-numbers: should import class_ph with multiple numeric values', () => {
      const input = loadTestJson('atl24x-numbers.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify multiple numeric class_ph [40, 41] was converted to strings ['bathymetry', 'sea_surface']
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.class_ph).toEqual(
        expect.arrayContaining(['bathymetry', 'sea_surface'])
      )
      expect(output.parms.atl24.class_ph).toHaveLength(2)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('atl24x-legacy: should import legacy classification field with warning', () => {
      const input = loadTestJson('atl24x-legacy.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify classification was converted to class_ph
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.class_ph).toEqual(expect.arrayContaining(['bathymetry']))

      // Verify warning was generated for legacy field
      expect(importErrors.length).toBeGreaterThan(0)
      expect(importErrors.some((e) => e.message.includes('classification'))).toBe(true)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
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

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('should generate warning for clockwise polygon (direction change)', () => {
      // Clockwise polygon: SW → NW → NE → SE (going north first, then east, then south, then west)
      const clockwiseInput = {
        poly: [
          { lon: -108.05, lat: 39.0 }, // SW
          { lon: -108.05, lat: 39.05 }, // NW
          { lon: -108.0, lat: 39.05 }, // NE
          { lon: -108.0, lat: 39.0 }, // SE
          { lon: -108.05, lat: 39.0 } // back to SW
        ]
      }

      applyParsedJsonToStores(clockwiseInput, reqParamsStore, rasterParamsStore, addError)

      // Should have a warning about direction change
      const polyErrors = importErrors.filter((e) => e.section === 'poly')
      expect(polyErrors.some((e) => e.message.includes('counter-clockwise direction'))).toBe(true)
    })

    it('should generate warning for starting point change', () => {
      // Test data uses clockwise polygon - convexHull will also change starting point
      const input = loadTestJson('atl03x.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      // Should have a warning about starting point change
      const polyErrors = importErrors.filter((e) => e.section === 'poly')
      expect(polyErrors.some((e) => e.message.includes('starting point'))).toBe(true)
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

  describe('Core request fields - xseries comprehensive test', () => {
    it('should import and export all core request fields for xseries APIs', () => {
      // Test input with ALL core request fields from xseries documentation:
      // asset (set automatically), resources, poly, proj, datum, timeout,
      // rqst-timeout, node-timeout, read-timeout, cluster_size_hint, region_mask, samples
      const input = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        proj: 0, // North Polar
        datum: 'EGM08',
        timeout: 300,
        'rqst-timeout': 400,
        'node-timeout': 500,
        'read-timeout': 600,
        cluster_size_hint: 8
      }

      applyParsedJsonToStores(input, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x')

      // Verify store state for all core fields
      expect(reqParamsStore.useProj).toBe(true)
      expect(reqParamsStore.projValue).toBe(0)
      expect(reqParamsStore.useDatum).toBe(true)
      expect(reqParamsStore.useServerTimeout).toBe(true)
      expect(reqParamsStore.serverTimeoutValue).toBe(300)
      expect(reqParamsStore.useReqTimeout).toBe(true)
      expect(reqParamsStore.reqTimeoutValue).toBe(400)
      expect(reqParamsStore.useNodeTimeout).toBe(true)
      expect(reqParamsStore.nodeTimeoutValue).toBe(500)
      expect(reqParamsStore.useReadTimeout).toBe(true)
      expect(reqParamsStore.readTimeoutValue).toBe(600)
      expect(reqParamsStore.useClusterSizeHint).toBe(true)
      expect(reqParamsStore.clusterSizeHintValue).toBe(8)

      // Verify export contains all core fields
      const output = reqParamsStore.getAtlxxReqParams(0)

      // Polygon (exported as convex hull when rasterize disabled)
      expect(output.parms.poly).toBeDefined()
      expect(Array.isArray(output.parms.poly)).toBe(true)

      // Projection
      expect(output.parms.proj).toBe(0)

      // Datum
      expect(output.parms.datum).toBe('EGM08')

      // Timeouts
      expect(output.parms.timeout).toBe(300)
      expect(output.parms['rqst-timeout']).toBe(400)
      expect(output.parms['node-timeout']).toBe(500)
      expect(output.parms['read-timeout']).toBe(600)

      // Cluster size hint
      expect(output.parms.cluster_size_hint).toBe(8)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('should handle all core request fields for atl24x API', () => {
      const input = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        proj: 1, // South Polar
        datum: 'EGM08',
        timeout: 900,
        'rqst-timeout': 900,
        'node-timeout': 900,
        'read-timeout': 900,
        cluster_size_hint: 16,
        atl24: {
          class_ph: ['bathymetry', 'sea_surface'],
          compact: true
        }
      }

      applyParsedJsonToStores(input, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl24x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify all core fields
      expect(output.parms.proj).toBe(1)
      expect(output.parms.datum).toBe('EGM08')
      expect(output.parms.timeout).toBe(900)
      expect(output.parms['rqst-timeout']).toBe(900)
      expect(output.parms['node-timeout']).toBe(900)
      expect(output.parms['read-timeout']).toBe(900)
      expect(output.parms.cluster_size_hint).toBe(16)

      // Verify ATL24-specific fields
      expect(output.parms.atl24).toBeDefined()
      expect(output.parms.atl24.class_ph).toEqual(
        expect.arrayContaining(['bathymetry', 'sea_surface'])
      )
      expect(output.parms.atl24.compact).toBe(true)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('should handle all core request fields for atl13x API', () => {
      const input = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        proj: 2, // Plate Carree
        datum: 'EGM08',
        timeout: 120,
        'rqst-timeout': 120,
        'node-timeout': 120,
        'read-timeout': 120,
        cluster_size_hint: 4,
        atl13: {
          coord: { lon: -108.025, lat: 39.025 }
        },
        atl13_fields: ['ht_ortho']
      }

      applyParsedJsonToStores(input, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl13x')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify all core fields
      expect(output.parms.proj).toBe(2)
      expect(output.parms.datum).toBe('EGM08')
      expect(output.parms.timeout).toBe(120)
      expect(output.parms['rqst-timeout']).toBe(120)
      expect(output.parms['node-timeout']).toBe(120)
      expect(output.parms['read-timeout']).toBe(120)
      expect(output.parms.cluster_size_hint).toBe(4)

      // Verify ATL13-specific fields
      expect(output.parms.atl13).toBeDefined()
      expect(output.parms.atl13.coord).toEqual({ lon: -108.025, lat: 39.025 })
      expect(output.parms.atl13_fields).toEqual(['ht_ortho'])

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('should handle all core request fields for atl03x-surface API', () => {
      const input = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        proj: 0, // North Polar
        datum: 'EGM08',
        timeout: 600,
        'rqst-timeout': 600,
        'node-timeout': 600,
        'read-timeout': 600,
        cluster_size_hint: 12,
        fit: {
          maxi: 6,
          h_win: 3.0,
          sigma_r: 5.0
        },
        len: 40.0,
        res: 20.0
      }

      applyParsedJsonToStores(input, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-surface')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify all core fields
      expect(output.parms.proj).toBe(0)
      expect(output.parms.datum).toBe('EGM08')
      expect(output.parms.timeout).toBe(600)
      expect(output.parms['rqst-timeout']).toBe(600)
      expect(output.parms['node-timeout']).toBe(600)
      expect(output.parms['read-timeout']).toBe(600)
      expect(output.parms.cluster_size_hint).toBe(12)

      // Verify surface fit fields
      expect(output.parms.fit).toBeDefined()
      expect(output.parms.fit.maxi).toBe(6)
      expect(output.parms.fit.h_win).toBe(3.0)
      expect(output.parms.fit.sigma_r).toBe(5.0)
      expect(output.parms.len).toBe(40.0)
      expect(output.parms.res).toBe(20.0)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })

    it('should handle all core request fields for atl03x-phoreal API', () => {
      const input = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        proj: 1, // South Polar
        datum: 'EGM08',
        timeout: 450,
        'rqst-timeout': 450,
        'node-timeout': 450,
        'read-timeout': 450,
        cluster_size_hint: 6,
        phoreal: {
          geoloc: 'mean',
          binsize: 1.0,
          above_classifier: true,
          use_abs_h: true
        }
      }

      applyParsedJsonToStores(input, reqParamsStore, rasterParamsStore, addError)

      reqParamsStore.setMissionValue('ICESat-2')
      reqParamsStore.setIceSat2API('atl03x-phoreal')

      const output = reqParamsStore.getAtlxxReqParams(0)

      // Verify all core fields
      expect(output.parms.proj).toBe(1)
      expect(output.parms.datum).toBe('EGM08')
      expect(output.parms.timeout).toBe(450)
      expect(output.parms['rqst-timeout']).toBe(450)
      expect(output.parms['node-timeout']).toBe(450)
      expect(output.parms['read-timeout']).toBe(450)
      expect(output.parms.cluster_size_hint).toBe(6)

      // Verify phoreal fields
      expect(output.parms.phoreal).toBeDefined()
      expect(output.parms.phoreal!.geoloc).toBe('mean')
      expect(output.parms.phoreal!.binsize).toBe(1.0)
      expect(output.parms.phoreal!.above_classifier).toBe(true)
      expect(output.parms.phoreal!.use_abs_h).toBe(true)

      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })
  })

  describe('Import issue categorization', () => {
    it('should categorize polygon adjustments as ADJUSTED', () => {
      // Clockwise polygon will trigger a reordering warning
      const clockwiseInput = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.05, lat: 39.0 }
        ]
      }

      applyParsedJsonToStores(clockwiseInput, reqParamsStore, rasterParamsStore, addError)

      // Should have warnings about polygon adjustments
      const polyErrors = importErrors.filter((e) => e.section === 'poly')
      expect(polyErrors.length).toBeGreaterThan(0)
      // Messages should contain "reordered" or "adjusted" or "starting point"
      expect(
        polyErrors.some(
          (e) =>
            e.message.includes('reordered') ||
            e.message.includes('adjusted') ||
            e.message.includes('starting point')
        )
      ).toBe(true)
    })

    it('should categorize unrecognized beam values as IGNORED', () => {
      const inputWithBadBeams = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        beams: ['gt1l', 'invalid_beam', 'gt2r']
      }

      applyParsedJsonToStores(inputWithBadBeams, reqParamsStore, rasterParamsStore, addError)

      // Should have warnings about unrecognized beams and format conversion
      const beamErrors = importErrors.filter((e) => e.section === 'beams')
      expect(beamErrors.length).toBe(2)
      expect(beamErrors.some((e) => e.message.includes('not recognized'))).toBe(true)
      expect(beamErrors.some((e) => e.message.includes('converted to numeric format'))).toBe(true)
    })

    it('should categorize invalid srt values as INVALID', () => {
      const inputWithBadSrt = {
        poly: [
          { lon: -108.05, lat: 39.0 },
          { lon: -108.0, lat: 39.0 },
          { lon: -108.0, lat: 39.05 },
          { lon: -108.05, lat: 39.05 },
          { lon: -108.05, lat: 39.0 }
        ],
        srt: ['not-a-number']
      }

      applyParsedJsonToStores(inputWithBadSrt, reqParamsStore, rasterParamsStore, addError)

      // Should have warning about invalid srt
      const srtErrors = importErrors.filter((e) => e.section === 'srt')
      expect(srtErrors.length).toBe(1)
      expect(srtErrors[0].message).toContain('invalid')
    })

    it('should categorize legacy parameter conversions as ADJUSTED', () => {
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

      // Should have warning about parameter name update
      const degradeErrors = importErrors.filter((e) => e.section === 'degrade')
      expect(degradeErrors.length).toBe(1)
      expect(degradeErrors[0].message).toContain('Parameter name updated')
    })
  })
})
