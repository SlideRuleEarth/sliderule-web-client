/**
 * Unit tests for ICESat-2 Request Fields import
 *
 * Tests for all ICESat-2 Request Fields from:
 * https://slideruleearth.io/web/rtd/user_guide/xseries.html#icesat-2-request-fields
 *
 * Fields tested:
 * - srt: Surface reference type
 * - pass_invalid: Permits results that don't meet quality standards
 * - dist_in_seg: Distance measurements using segment units
 * - cnf: ATL03 confidence filter
 * - quality_ph: Photon quality classification filter
 * - atl08_class: ATL08 classification filter
 * - beams: Detector beam selection
 * - tracks: Orbital track selection
 * - len: Length of photon segment
 * - res: Resolution/step size
 * - ats: Minimum along-track spread
 * - cnt: Minimum photons per segment
 * - fit: Surface fitting algorithm configuration
 * - yapc: YAPC algorithm settings
 * - phoreal: PhoREAL algorithm configuration
 * - atl24: ATL24 algorithm settings
 * - atl03_geo_fields: Ancillary fields from geolocation group
 * - atl03_corr_fields: Ancillary fields from geophysical corrections
 * - atl03_ph_fields: Ancillary fields from heights group
 * - atl06_fields: Additional ATL06 ancillary fields
 * - atl08_fields: Additional ATL08 ancillary fields
 * - atl13_fields: Additional ATL13 ancillary fields
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { applyParsedJsonToStores } from '@/utils/applyParsedJsonToStores'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useRasterParamsStore } from '@/stores/rasterParamsStore'

const testDataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')

function loadTestJson(filename: string): any {
  const filePath = path.join(testDataDir, filename)
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Filter out informational warnings from import errors.
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

describe('ICESat-2 Request Fields Import', () => {
  let reqParamsStore: ReturnType<typeof useReqParamsStore>
  let rasterParamsStore: ReturnType<typeof useRasterParamsStore>
  let importErrors: Array<{ section: string; message: string }>
  let addError: (_section: string, _message: string) => void

  beforeEach(() => {
    setActivePinia(createPinia())
    reqParamsStore = useReqParamsStore()
    rasterParamsStore = useRasterParamsStore()
    reqParamsStore.reset()
    rasterParamsStore.$reset()
    importErrors = []
    addError = (section, message) => importErrors.push({ section, message })
  })

  describe('Test data file availability', () => {
    it('should have icesat2-request-fields.json test file available', () => {
      const testFilePath = path.join(testDataDir, 'icesat2-request-fields.json')
      expect(fs.existsSync(testFilePath)).toBe(true)
    })
  })

  describe('All ICESat-2 Request Fields', () => {
    it('should import all ICESat-2 request fields from test data file', () => {
      const input = loadTestJson('icesat2-request-fields.json')
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)

      // srt - Surface reference type
      expect(reqParamsStore.enableAtl03Classification).toBe(true)
      expect(reqParamsStore.surfaceReferenceType.map((s) => s.value)).toEqual(
        expect.arrayContaining([0, 1, 2])
      )

      // pass_invalid
      expect(reqParamsStore.passInvalid).toBe(true)

      // dist_in_seg
      expect(reqParamsStore.distanceIn).toEqual({ name: 'segments', value: 'segments' })

      // cnf - ATL03 confidence filter
      expect(reqParamsStore.signalConfidence.map((c) => c.value)).toEqual(
        expect.arrayContaining([2, 3, 4])
      )

      // quality_ph
      expect(reqParamsStore.qualityPH.map((q) => q.value)).toEqual(
        expect.arrayContaining([0, 1, 2, 3])
      )

      // atl08_class
      expect(reqParamsStore.enableAtl08Classification).toBe(true)
      expect(reqParamsStore.atl08LandType).toEqual(
        expect.arrayContaining(['atl08_ground', 'atl08_canopy', 'atl08_top_of_canopy'])
      )

      // beams
      expect(reqParamsStore.getSelectedGtOptions()).toHaveLength(6)
      expect(reqParamsStore.getSelectedGtOptions().map((g: { label: string }) => g.label)).toEqual(
        expect.arrayContaining(['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'])
      )

      // tracks
      expect(reqParamsStore.getSelectedTrackOptions()).toHaveLength(3)
      expect(
        reqParamsStore.getSelectedTrackOptions().map((t: { value: number }) => t.value)
      ).toEqual(expect.arrayContaining([1, 2, 3]))

      // len
      expect(reqParamsStore.useLength).toBe(true)
      expect(reqParamsStore.lengthValue).toBe(40.0)

      // res
      expect(reqParamsStore.useStep).toBe(true)
      expect(reqParamsStore.stepValue).toBe(20.0)

      // ats
      expect(reqParamsStore.useAlongTrackSpread).toBe(true)
      expect(reqParamsStore.alongTrackSpread).toBe(10.0)

      // cnt
      expect(reqParamsStore.useMinimumPhotonCount).toBe(true)
      expect(reqParamsStore.minimumPhotonCount).toBe(10)

      // fit
      expect(reqParamsStore.useSurfaceFitAlgorithm).toBe(true)
      expect(reqParamsStore.useMaxIterations).toBe(true)
      expect(reqParamsStore.maxIterations).toBe(6)
      expect(reqParamsStore.useMinWindowHeight).toBe(true)
      expect(reqParamsStore.minWindowHeight).toBe(3.0)
      expect(reqParamsStore.useMaxRobustDispersion).toBe(true)
      expect(reqParamsStore.getSigmaRmax()).toBe(5.0)

      // yapc
      expect(reqParamsStore.enableYAPC).toBe(true)
      expect(reqParamsStore.YAPCScore).toBe(100)
      expect(reqParamsStore.usesYAPCKnn).toBe(true)
      expect(reqParamsStore.YAPCKnn).toBe(0)
      expect(reqParamsStore.usesYAPCMinKnn).toBe(true)
      expect(reqParamsStore.YAPCMinKnn).toBe(5)
      expect(reqParamsStore.usesYAPCWindowHeight).toBe(true)
      expect(reqParamsStore.YAPCWindowHeight).toBe(6.0)
      expect(reqParamsStore.usesYAPCWindowWidth).toBe(true)
      expect(reqParamsStore.YAPCWindowWidth).toBe(15.0)
      expect(reqParamsStore.YAPCVersion).toBe(3)

      // Note: phoreal is tested separately since fit and phoreal are mutually exclusive

      // atl24
      expect(reqParamsStore.enableAtl24Classification).toBe(true)
      expect(reqParamsStore.useAtl24Classification).toBe(true)
      expect(reqParamsStore.atl24_class_ph).toEqual(
        expect.arrayContaining(['bathymetry', 'sea_surface'])
      )
      expect(reqParamsStore.useAtl24Compact).toBe(true)
      expect(reqParamsStore.atl24Compact).toBe(true)
      expect(reqParamsStore.useAtl24ConfidenceThreshold).toBe(true)
      expect(reqParamsStore.atl24ConfidenceThreshold).toBe(0.7)

      // atl03_geo_fields
      expect(reqParamsStore.atl03_geo_fields).toEqual(['solar_elevation', 'solar_azimuth'])

      // atl03_corr_fields
      expect(reqParamsStore.atl03_corr_fields).toEqual(['geoid', 'dac'])

      // atl03_ph_fields
      expect(reqParamsStore.atl03_ph_fields).toEqual(['dist_ph_along', 'dist_ph_across'])

      // atl06_fields
      expect(reqParamsStore.atl06_fields).toEqual(['ground_track/ref_azimuth', 'h_li_sigma'])

      // atl08_fields
      expect(reqParamsStore.atl08_fields).toEqual(['segment_snowcover', 'segment_landcover'])

      // atl13_fields
      expect(reqParamsStore.atl13_fields).toEqual(['ht_ortho', 'water_depth'])

      // No unexpected errors
      expect(getNonPolygonErrors(importErrors)).toHaveLength(0)
    })
  })

  describe('Individual ICESat-2 Request Fields', () => {
    let input: any

    beforeEach(() => {
      input = loadTestJson('icesat2-request-fields.json')
    })

    it('srt: should import surface reference type as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.enableAtl03Classification).toBe(true)
      expect(reqParamsStore.surfaceReferenceType.map((s) => s.value)).toEqual(
        expect.arrayContaining(input.parms.srt)
      )
    })

    it('pass_invalid: should import pass_invalid boolean', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.passInvalid).toBe(input.parms.pass_invalid)
    })

    it('dist_in_seg: should import dist_in_seg boolean', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.distanceIn.value).toBe('segments')
    })

    it('cnf: should import ATL03 confidence filter as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.signalConfidence.map((c) => c.value)).toEqual(
        expect.arrayContaining(input.parms.cnf)
      )
    })

    it('quality_ph: should import photon quality filter as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.qualityPH.map((q) => q.value)).toEqual(
        expect.arrayContaining(input.parms.quality_ph)
      )
    })

    it('atl08_class: should import ATL08 classification as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.enableAtl08Classification).toBe(true)
      expect(reqParamsStore.atl08LandType).toEqual(expect.arrayContaining(input.parms.atl08_class))
    })

    it('beams: should import detector beams as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.getSelectedGtOptions().map((g: { label: string }) => g.label)).toEqual(
        expect.arrayContaining(input.parms.beams)
      )
    })

    it('tracks: should import orbital tracks as array', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(
        reqParamsStore.getSelectedTrackOptions().map((t: { value: number }) => t.value)
      ).toEqual(expect.arrayContaining(input.parms.tracks))
    })

    it('len: should import segment length', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.useLength).toBe(true)
      expect(reqParamsStore.lengthValue).toBe(input.parms.len)
    })

    it('res: should import step/resolution', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.useStep).toBe(true)
      expect(reqParamsStore.stepValue).toBe(input.parms.res)
    })

    it('ats: should import along-track spread', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.useAlongTrackSpread).toBe(true)
      expect(reqParamsStore.alongTrackSpread).toBe(input.parms.ats)
    })

    it('cnt: should import minimum photon count', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.useMinimumPhotonCount).toBe(true)
      expect(reqParamsStore.minimumPhotonCount).toBe(input.parms.cnt)
    })

    it('fit: should import surface fit algorithm parameters', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.useSurfaceFitAlgorithm).toBe(true)
      expect(reqParamsStore.maxIterations).toBe(input.parms.fit.maxi)
      expect(reqParamsStore.minWindowHeight).toBe(input.parms.fit.h_win)
      expect(reqParamsStore.getSigmaRmax()).toBe(input.parms.fit.sigma_r)
    })

    it('yapc: should import YAPC algorithm parameters', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.enableYAPC).toBe(true)
      expect(reqParamsStore.YAPCScore).toBe(input.parms.yapc.score)
      expect(reqParamsStore.YAPCKnn).toBe(input.parms.yapc.knn)
      expect(reqParamsStore.YAPCMinKnn).toBe(input.parms.yapc.min_knn)
      expect(reqParamsStore.YAPCWindowHeight).toBe(input.parms.yapc.win_h)
      expect(reqParamsStore.YAPCWindowWidth).toBe(input.parms.yapc.win_x)
      expect(reqParamsStore.YAPCVersion).toBe(input.parms.yapc.version)
    })

    it('phoreal: should import PhoREAL algorithm parameters', () => {
      // phoreal is mutually exclusive with fit, so load from separate file
      const phorealInput = loadTestJson('icesat2-phoreal-fields.json')
      applyParsedJsonToStores(phorealInput.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.enablePhoReal).toBe(true)
      expect(reqParamsStore.phoRealGeoLocation).toBe(phorealInput.parms.phoreal.geoloc)
      expect(reqParamsStore.phoRealBinSize).toBe(phorealInput.parms.phoreal.binsize)
      expect(reqParamsStore.usePhoRealABoVEClassifier).toBe(
        phorealInput.parms.phoreal.above_classifier
      )
      expect(reqParamsStore.usePhoRealAbsoluteHeights).toBe(phorealInput.parms.phoreal.use_abs_h)
      expect(reqParamsStore.usePhoRealSendWaveforms).toBe(phorealInput.parms.phoreal.send_waveform)
    })

    it('atl24: should import ATL24 algorithm parameters', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.enableAtl24Classification).toBe(true)
      expect(reqParamsStore.atl24_class_ph).toEqual(
        expect.arrayContaining(input.parms.atl24.class_ph)
      )
      expect(reqParamsStore.atl24Compact).toBe(input.parms.atl24.compact)
      expect(reqParamsStore.atl24ConfidenceThreshold).toBe(input.parms.atl24.confidence_threshold)
    })

    it('atl03_geo_fields: should import geolocation ancillary fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl03_geo_fields).toEqual(input.parms.atl03_geo_fields)
    })

    it('atl03_corr_fields: should import geophysical correction fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl03_corr_fields).toEqual(input.parms.atl03_corr_fields)
    })

    it('atl03_ph_fields: should import heights group ancillary fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl03_ph_fields).toEqual(input.parms.atl03_ph_fields)
    })

    it('atl06_fields: should import ATL06 ancillary fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl06_fields).toEqual(input.parms.atl06_fields)
    })

    it('atl08_fields: should import ATL08 ancillary fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl08_fields).toEqual(input.parms.atl08_fields)
    })

    it('atl13_fields: should import ATL13 ancillary fields', () => {
      applyParsedJsonToStores(input.parms, reqParamsStore, rasterParamsStore, addError)
      expect(reqParamsStore.atl13_fields).toEqual(input.parms.atl13_fields)
    })
  })
})
