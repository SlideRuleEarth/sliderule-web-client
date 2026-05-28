/**
 * Unit tests for endpoint parameter scoping (Issue #1074)
 *
 * Verifies that X-series endpoints (atl06x, atl08x, atl24x, atl13x) do not
 * include photon-processing parameters in their requests, since they read
 * pre-computed segments from HDF5 files and the server ignores these params.
 *
 * P-series endpoints (atl06p, atl03x, etc.) compute from ATL03 photons and
 * should include these parameters when enabled.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { photonProcessingAPIs } from '@/types/SrStaticOptions'

describe('Endpoint Parameter Scoping', () => {
  let store: ReturnType<typeof useReqParamsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useReqParamsStore()
    store.reset()
  })

  function enableAllPhotonParams() {
    store.missionValue = 'ICESat-2'
    store.enableAtl03Classification = true
    store.enableAtl08Classification = true
    store.atl08LandType = ['atl08_ground']
    store.enableYAPC = true
    store.YAPCScore = 100
    store.useLength = true
    store.lengthValue = 40
    store.useStep = true
    store.stepValue = 20
    store.useSurfaceFitAlgorithm = true
    store.useMaxIterations = true
    store.maxIterations = 6
    store.passInvalid = true
    store.distanceIn = { name: 'segments', value: 'segments' }
    store.useAlongTrackSpread = true
    store.alongTrackSpread = 10
    store.useMinimumPhotonCount = true
    store.minimumPhotonCount = 5
  }

  const photonParamKeys = [
    'cnf',
    'srt',
    'quality_ph',
    'atl08_class',
    'yapc',
    'len',
    'res',
    'fit',
    'pass_invalid',
    'dist_in_seg',
    'ats',
    'cnt'
  ]

  describe('X-series endpoints should exclude photon-processing params', () => {
    const xSeriesAPIs = ['atl06x', 'atl08x', 'atl24x', 'atl13x']

    xSeriesAPIs.forEach((api) => {
      it(`${api} request should not include photon-processing parameters`, () => {
        enableAllPhotonParams()
        store.iceSat2SelectedAPI = api
        const req = store.getAtlReqParams(1)

        for (const key of photonParamKeys) {
          expect(req).not.toHaveProperty(key)
        }
      })
    })
  })

  describe('P-series endpoints should include photon-processing params when enabled', () => {
    it('atl06p request should include fit, len, res when enabled', () => {
      enableAllPhotonParams()
      store.iceSat2SelectedAPI = 'atl06p'
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('fit')
      expect(req).toHaveProperty('len', 40)
      expect(req).toHaveProperty('res', 20)
      expect(req).toHaveProperty('pass_invalid', true)
      expect(req).toHaveProperty('dist_in_seg', true)
      expect(req).toHaveProperty('yapc')
      expect(req).toHaveProperty('atl08_class')
    })

    it('atl03x request should include photon params when enabled', () => {
      enableAllPhotonParams()
      store.iceSat2SelectedAPI = 'atl03x'
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('len', 40)
      expect(req).toHaveProperty('res', 20)
      expect(req).toHaveProperty('pass_invalid', true)
      expect(req).toHaveProperty('yapc')
      expect(req).toHaveProperty('atl08_class')
    })

    it('atl08p request should include photon params when enabled', () => {
      enableAllPhotonParams()
      store.iceSat2SelectedAPI = 'atl08p'
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('len', 40)
      expect(req).toHaveProperty('res', 20)
      expect(req).toHaveProperty('pass_invalid', true)
      expect(req).toHaveProperty('yapc')
      expect(req).toHaveProperty('atl08_class')
    })
  })

  describe('Endpoint-specific params still work for X-series', () => {
    it('atl24x should include atl24-specific params', () => {
      store.missionValue = 'ICESat-2'
      store.iceSat2SelectedAPI = 'atl24x'
      store.enableAtl24Classification = true
      store.useAtl24Compact = true
      store.atl24Compact = true
      store.useAtl24Classification = true
      store.atl24_class_ph = ['bathymetry']
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('atl24')
      expect(req.atl24).toHaveProperty('compact', true)
      expect(req.atl24).toHaveProperty('class_ph')
    })

    it('atl13x should include atl13-specific params', () => {
      store.missionValue = 'ICESat-2'
      store.iceSat2SelectedAPI = 'atl13x'
      store.useAtl13RefId = true
      store.atl13 = { refid: 42, name: 'test-lake', coord: null }
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('atl13')
      expect(req.atl13).toHaveProperty('refid', 42)
    })

    it('atl06x should include atl06_fields when set', () => {
      store.missionValue = 'ICESat-2'
      store.iceSat2SelectedAPI = 'atl06x'
      store.atl06_fields = ['h_li_sigma']
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('atl06_fields', ['h_li_sigma'])
    })
  })

  describe('Universal params work for all endpoints', () => {
    it('timeout and output should be included for X-series endpoints', () => {
      store.missionValue = 'ICESat-2'
      store.iceSat2SelectedAPI = 'atl06x'
      store.useServerTimeout = true
      store.serverTimeoutValue = 300
      store.fileOutput = true
      const req = store.getAtlReqParams(1)

      expect(req).toHaveProperty('timeout', 300)
      expect(req).toHaveProperty('output')
    })
  })

  describe('photonProcessingAPIs set is correct', () => {
    it('should contain all P-series and ATL03-based endpoints', () => {
      const expected = [
        'atl03x',
        'atl03x-surface',
        'atl03x-phoreal',
        'atl03vp',
        'atl06p',
        'atl06sp',
        'atl08p'
      ]
      for (const api of expected) {
        expect(photonProcessingAPIs.has(api)).toBe(true)
      }
    })

    it('should not contain X-series endpoints', () => {
      const xSeries = ['atl06x', 'atl08x', 'atl24x', 'atl13x']
      for (const api of xSeries) {
        expect(photonProcessingAPIs.has(api)).toBe(false)
      }
    })
  })
})
