// src/utils/applyParsedJsonToStores.ts
import { mapGtStringsToSrListNumberItems, tracksOptions } from '@/utils/parmUtils'
import { coerceToNumberArray } from '@/utils/coerceUtils'
import {
  surfaceReferenceTypeOptions,
  signalConfidenceNumberOptions,
  qualityPHOptions
} from '@/types/SrStaticOptions'
import { convexHull, calculatePolygonArea } from '@/composables/SrTurfUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ApplyParsedJsonToStores')

export function applyParsedJsonToStores(
  data: any,
  store: ReturnType<typeof import('@/stores/reqParamsStore').useReqParamsStore>,
  rasterStore: ReturnType<typeof import('@/stores/rasterParamsStore').useRasterParamsStore>,
  _addError: (_section: string, _message: string) => void
) {
  //console.log('Applying parsed JSON data to stores:', data);

  if (data.poly !== undefined) {
    store.setPoly(data.poly)
    if (data.poly && data.poly.length > 0) {
      store.setConvexHull(convexHull(data.poly))
      store.setAreaOfConvexHull(calculatePolygonArea(data.poly))
    }
  }
  if (data.rgt !== undefined) {
    //console.log('RGT data found:', data.rgt);
    store.setEnableGranuleSelection(true)
    store.setUseRgt(true)
    store.setRgt(data.rgt)
  }
  if (data.cycle !== undefined) {
    logger.debug('Cycle data found', { cycle: data.cycle })
    store.setEnableGranuleSelection(true)
    store.setUseCycle(true)
    store.setCycle(data.cycle)
  }
  if (data.region !== undefined) {
    //console.log('Region data found:', data.region);
    store.setEnableGranuleSelection(true)
    store.setUseRegion(true)
    store.setRegion(data.region)
  }
  if (data.t0) {
    store.setEnableGranuleSelection(true)
    store.setUseTime(true)
    store.setT0(new Date(data.t0))
  }
  if (data.t1) {
    store.setEnableGranuleSelection(true)
    store.setUseTime(true)
    store.setT1(new Date(data.t1))
  }

  if (data.beams !== undefined) {
    // Handle ICESat-2 beams (array of strings like "gt1l", "gt2r")
    if (Array.isArray(data.beams)) {
      store.setEnableGranuleSelection(true)
      const matched = mapGtStringsToSrListNumberItems(data.beams)
      store.setSelectedGtOptions(matched)
      const unmatched = data.beams.filter(
        (name: string) => !matched.some((gt) => gt.label === name)
      )
      if (unmatched.length > 0) {
        _addError('beams', `unrecognized value(s): ${unmatched.join(', ')}`)
      }
    } else if (typeof data.beams === 'number') {
      // Handle GEDI beams (number - 0 means all beams)
      store.gediBeams = data.beams === 0 ? [0, 1, 2, 3, 5, 6, 8, 11] : [data.beams]
    }
  }

  // Handle ICESat-2 tracks (array of numbers like [1, 2, 3])
  if (data.tracks !== undefined && Array.isArray(data.tracks)) {
    store.setEnableGranuleSelection(true)
    const matched = tracksOptions.filter((opt) => data.tracks.includes(opt.value))
    store.setSelectedTrackOptions(matched)
    const unmatched = data.tracks.filter(
      (v: number) => !tracksOptions.some((opt) => opt.value === v)
    )
    if (unmatched.length > 0) {
      _addError('tracks', `unrecognized value(s): ${unmatched.join(', ')}`)
    }
  }

  // Handle GEDI-specific quality filter parameters
  // Current naming: degrade_filter, l2_quality_filter, etc.
  // Also accepts legacy short names (degrade, l2_quality, etc.) for backwards compatibility
  if (data.degrade_filter !== undefined) {
    store.degradeFlag = data.degrade_filter
  } else if (data.degrade !== undefined) {
    store.degradeFlag = data.degrade
    _addError('degrade', 'Legacy parameter name "degrade" converted to "degrade_filter"')
  }
  if (data.l2_quality_filter !== undefined) {
    store.l2QualityFlag = data.l2_quality_filter
  } else if (data.l2_quality !== undefined) {
    store.l2QualityFlag = data.l2_quality
    _addError('l2_quality', 'Legacy parameter name "l2_quality" converted to "l2_quality_filter"')
  }
  if (data.l4_quality_filter !== undefined) {
    store.l4QualityFlag = data.l4_quality_filter
  } else if (data.l4_quality !== undefined) {
    store.l4QualityFlag = data.l4_quality
    _addError('l4_quality', 'Legacy parameter name "l4_quality" converted to "l4_quality_filter"')
  }
  if (data.surface_flag !== undefined) {
    store.surfaceFlag = data.surface_flag
  } else if (data.surface !== undefined) {
    store.surfaceFlag = data.surface
    _addError('surface', 'Legacy parameter name "surface" converted to "surface_flag"')
  }

  if (data.cnf) {
    coerce('cnf', data.cnf, (v) => {
      store.signalConfidence = signalConfidenceNumberOptions.filter((opt) => v.includes(opt.value))
    })
  }
  if (data.quality_ph) {
    coerce('quality_ph', data.quality_ph, (v) => {
      store.qualityPH = qualityPHOptions.filter((opt) => v.includes(opt.value))
    })
  }

  // Handle ATL06/ATL08 fields
  if (data.atl06_fields && Array.isArray(data.atl06_fields)) {
    store.atl06_fields = data.atl06_fields
  }
  if (data.atl08_fields && Array.isArray(data.atl08_fields)) {
    store.atl08_fields = data.atl08_fields
  }

  // Handle ATL03 field arrays
  if (data.atl03_geo_fields && Array.isArray(data.atl03_geo_fields)) {
    store.atl03_geo_fields = data.atl03_geo_fields
  }
  if (data.atl03_corr_fields && Array.isArray(data.atl03_corr_fields)) {
    store.atl03_corr_fields = data.atl03_corr_fields
  }
  if (data.atl03_ph_fields && Array.isArray(data.atl03_ph_fields)) {
    store.atl03_ph_fields = data.atl03_ph_fields
  }

  // Handle ATL13 and GEDI field arrays
  if (data.atl13_fields && Array.isArray(data.atl13_fields)) {
    store.atl13_fields = data.atl13_fields
  }
  if (data.gedi_fields && Array.isArray(data.gedi_fields)) {
    store.gedi_fields = data.gedi_fields
  }

  // Handle ancillary fields (anc_fields can be for ATL03 or ATL08 depending on context)
  if (data.anc_fields && Array.isArray(data.anc_fields)) {
    // For now, store in both - the export will use the appropriate one based on API
    store.atl03AncillaryFields = data.anc_fields
    store.atl08AncillaryFields = data.anc_fields
  }

  // Handle max_resources
  if (data.max_resources !== undefined) {
    store.setUseMaxResources(true)
    store.setMaxResources(data.max_resources)
  }

  if (data.cnt !== undefined) {
    store.setUseMinimumPhotonCount(true)
    coerce('cnt', data.cnt, (v) => store.setMinimumPhotonCount(v[0]))
  }
  if (data.ats !== undefined) {
    store.setUseAlongTrackSpread(true)
    coerce('ats', data.ats, (v) => store.setAlongTrackSpread(v[0]))
    logger.debug('Parsing srt values', { srt: data.srt })
  }
  if (data.srt !== undefined) {
    let values: number[] = []
    if (Array.isArray(data.srt)) {
      values = (data.srt as (string | number)[])
        .map((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
        .filter((v): v is number => typeof v === 'number' && !isNaN(v))
    } else if (typeof data.srt === 'number') {
      values = [data.srt]
    }
    logger.debug('Parsed srt values', { values })
    if (values.length > 0) {
      store.surfaceReferenceType = surfaceReferenceTypeOptions.filter((opt) =>
        values.includes(opt.value)
      )
      store.enableAtl03Classification = true
    } else {
      store.surfaceReferenceType = []
      _addError('srt', `invalid value: ${JSON.stringify(data.srt)}`)
    }
  }

  if (data.len !== undefined) {
    store.setUseLength(true)
    store.setLengthValue(data.len)
  }
  if (data.res !== undefined) {
    store.setUseStep(true)
    store.setStepValue(data.res)
  }
  if (data.pass_invalid !== undefined) {
    store.setPassInvalid(data.pass_invalid)
  }
  if (data.timeout !== undefined) {
    store.setUseServerTimeout(true)
    store.setServerTimeout(data.timeout)
  }
  if (data['rqst-timeout'] !== undefined) {
    store.setUseReqTimeout(true)
    store.setReqTimeout(data['rqst-timeout'])
  }
  if (data['node-timeout'] !== undefined) {
    store.setUseNodeTimeout(true)
    store.setNodeTimeout(data['node-timeout'])
  }
  if (data['read-timeout'] !== undefined) {
    store.setUseReadTimeout(true)
    store.setReadTimeout(data['read-timeout'])
  }
  if (data.datum === 'EGM08') store.useDatum = true
  if (data.dist_in_seg) store.distanceIn = { name: 'segments', value: 'segments' }

  if (data.atl08_class) {
    store.enableAtl08Classification = true
    store.atl08LandType = data.atl08_class
  }

  if (data.atl13) {
    store.useAtl13Point = !!data.atl13.coord
    store.atl13 = { ...store.atl13, ...data.atl13 }
    if ('refid' in data.atl13) {
      store.useAtl13RefId = true
    }
  }

  if (data.atl24) {
    store.enableAtl24Classification = true
    if (data.atl24.compact !== undefined)
      (store.useAtl24Compact = true), (store.atl24Compact = data.atl24.compact)
    if (data.atl24.classification !== undefined)
      (store.useAtl24Classification = true), (store.atl24_class_ph = data.atl24.classification)
    if (data.atl24.confidence_threshold !== undefined)
      (store.useAtl24ConfidenceThreshold = true),
        (store.atl24ConfidenceThreshold = data.atl24.confidence_threshold)
    if (data.atl24.invalid_kd !== undefined)
      (store.useAtl24InvalidKD = true), (store.atl24InvalidKD = data.atl24.invalid_kd)
    if (data.atl24.invalid_wind_speed !== undefined)
      (store.useAtl24InvalidWindspeed = true),
        (store.atl24InvalidWindspeed = data.atl24.invalid_wind_speed)
    if (data.atl24.low_confidence !== undefined)
      (store.useAtl24LowConfidence = true), (store.atl24LowConfidence = data.atl24.low_confidence)
    if (data.atl24.night !== undefined)
      (store.useAtl24Night = true), (store.atl24Night = data.atl24.night)
    if (data.atl24.sensor_depth_exceeded !== undefined)
      (store.useAtl24SensorDepthExceeded = true),
        (store.atl24SensorDepthExceeded = data.atl24.sensor_depth_exceeded)
    if (data.atl24.anc_fields) store.atl24AncillaryFields = data.atl24.anc_fields
  }

  if (data.yapc) {
    store.enableYAPC = true
    store.setYAPCScore(data.yapc.score)
    if ('knn' in data.yapc) store.setUseYAPCKnn(true), store.setYAPCKnn(data.yapc.knn)
    if ('min_knn' in data.yapc) store.setUseYAPCMinKnn(true), store.setYAPCMinKnn(data.yapc.min_knn)
    if ('win_h' in data.yapc)
      store.setUsesYAPCWindowHeight(true), store.setYAPCWindowHeight(data.yapc.win_h)
    if ('win_x' in data.yapc)
      store.setUsesYAPCWindowWidth(true), store.setYAPCWindowWidth(data.yapc.win_x)
    if ('version' in data.yapc && data.yapc.version !== undefined)
      store.setYAPCVersion(data.yapc.version)
  }

  // Handle fit (surface fit algorithm) parameters
  // Note: We need to explicitly check for presence/absence of fit to override the default true value
  if (data.fit !== undefined) {
    // If fit is present (even if empty), enable surface fit
    // Empty {} tells the server to use its defaults
    store.setUseSurfaceFitAlgorithm(true)

    // Only set specific values if they exist in the fit object
    if (typeof data.fit === 'object' && data.fit !== null) {
      if ('maxi' in data.fit) {
        store.setUseMaxIterations(true)
        store.setMaxIterations(data.fit.maxi)
      }
      // Accept both h_win (current) and H_min_win (legacy)
      if ('h_win' in data.fit) {
        store.setUseMinWindowHeight(true)
        store.setMinWindowHeight(data.fit.h_win)
      } else if ('H_min_win' in data.fit) {
        store.setUseMinWindowHeight(true)
        store.setMinWindowHeight(data.fit.H_min_win)
        _addError('fit.H_min_win', 'Legacy parameter name "H_min_win" converted to "h_win"')
      }
      // Accept both sigma_r (current) and sigma_r_max (legacy)
      if ('sigma_r' in data.fit) {
        store.setUseMaxRobustDispersion(true)
        store.setSigmaRmax(data.fit.sigma_r)
      } else if ('sigma_r_max' in data.fit) {
        store.setUseMaxRobustDispersion(true)
        store.setSigmaRmax(data.fit.sigma_r_max)
        _addError('fit.sigma_r_max', 'Legacy parameter name "sigma_r_max" converted to "sigma_r"')
      }
    }
  } else {
    // If fit is not present at all in loaded parameters, turn off surface fit
    // This handles cases like ATL03x photon cloud where fit should not be used
    store.setUseSurfaceFitAlgorithm(false)
  }

  // Handle phoreal parameters
  if (data.phoreal !== undefined) {
    // If phoreal is present (even if empty), enable PhoREAL
    // Empty {} tells the server to use its defaults
    store.setEnablePhoReal(true)

    // Only set specific values if they exist in the phoreal object
    if (typeof data.phoreal === 'object' && data.phoreal !== null) {
      if ('geoloc' in data.phoreal) {
        store.usePhoRealGeoLocation = true
        store.phoRealGeoLocation = data.phoreal.geoloc
      }
      if ('binsize' in data.phoreal) {
        store.usePhoRealBinSize = true
        store.phoRealBinSize = data.phoreal.binsize
      }
      if ('above_classifier' in data.phoreal) {
        store.usePhoRealABoVEClassifier = data.phoreal.above_classifier
      }
      if ('use_abs_h' in data.phoreal) {
        store.usePhoRealAbsoluteHeights = data.phoreal.use_abs_h
      }
      if ('send_waveform' in data.phoreal) {
        store.usePhoRealSendWaveforms = data.phoreal.send_waveform
      }
    }
  } else {
    // If phoreal is not present at all in loaded parameters, turn off PhoREAL
    store.setEnablePhoReal(false)
  }

  // Handle output options
  if (data.output && typeof data.output === 'object') {
    if ('with_checksum' in data.output) {
      store.setUseChecksum(data.output.with_checksum)
    }
  }

  // Handle raster sampling parameters
  if (data.samples && typeof data.samples === 'object') {
    rasterStore.setParmsFromJson(data.samples)
  }

  function coerce(field: string, _input: unknown, assign: (_v: number[]) => void) {
    const { valid, invalid } = coerceToNumberArray(_input)
    assign(valid)
    if (invalid.length > 0) _addError(field, `invalid value(s): ${invalid.join(', ')}`)
  }
}
