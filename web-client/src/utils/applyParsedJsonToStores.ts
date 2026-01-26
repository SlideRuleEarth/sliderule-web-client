// src/utils/applyParsedJsonToStores.ts
import { mapGtStringsToSrListNumberItems, tracksOptions } from '@/utils/parmUtils'
import { coerceToNumberArray } from '@/utils/coerceUtils'
import {
  surfaceReferenceTypeOptions,
  signalConfidenceNumberOptions,
  qualityPHOptions
} from '@/types/SrStaticOptions'
import { convexHull, calculatePolygonArea, isClockwise } from '@/composables/SrTurfUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ApplyParsedJsonToStores')

// ATL24 class_ph value to name mapping (for converting numeric values to strings)
// API uses class_ph with values: 0=unclassified, 40=bathymetry, 41=sea_surface
// Legacy "classification" field is also supported for backward compatibility
const atl24ClassificationValueToName: Record<number, string> = {
  0: 'unclassified',
  40: 'bathymetry',
  41: 'sea_surface'
}

// Convert class_ph array (which may contain numbers or strings) to string names
// Returns the converted array and info about any numeric conversions
function convertClassificationToStrings(classValues: (number | string)[]): {
  values: string[]
  conversions: Array<{ from: number; to: string }>
} {
  const values: string[] = []
  const conversions: Array<{ from: number; to: string }> = []

  for (const val of classValues) {
    if (typeof val === 'string') {
      values.push(val)
    } else {
      const stringVal = atl24ClassificationValueToName[val] ?? String(val)
      values.push(stringVal)
      conversions.push({ from: val, to: stringVal })
    }
  }

  return { values, conversions }
}

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
      // Check original polygon properties before convex hull
      const originalIsClockwise = isClockwise(data.poly)
      const originalStart = data.poly[0]

      const hull = convexHull(data.poly)
      store.setConvexHull(hull)
      store.setAreaOfConvexHull(calculatePolygonArea(data.poly))

      // Warning for vertex count change (shape simplification)
      if (hull.length !== data.poly.length) {
        logger.debug(
          `Polygon contained concave vertices - simplified to convex hull (${data.poly.length} → ${hull.length} vertices)`
        )
        _addError(
          'poly',
          `Polygon adjusted to convex shape (${data.poly.length} → ${hull.length} vertices) - ensures complete coverage of your selected region`
        )
      }

      // Warning for direction change (convexHull always returns counter-clockwise)
      if (originalIsClockwise) {
        logger.debug(
          'Polygon winding direction reversed: clockwise → counter-clockwise (GeoJSON standard for exterior rings)'
        )
        _addError(
          'poly',
          'Polygon vertices reordered to counter-clockwise direction (this is normal - your region is unchanged)'
        )
      }

      // Warning for starting point change
      const hullStart = hull[0]
      if (originalStart.lon !== hullStart.lon || originalStart.lat !== hullStart.lat) {
        logger.debug(
          `Polygon starting vertex changed: convex hull algorithm selected (${hullStart.lon.toFixed(4)}, ${hullStart.lat.toFixed(4)}) as canonical start, was (${originalStart.lon.toFixed(4)}, ${originalStart.lat.toFixed(4)})`
        )
        _addError(
          'poly',
          'Polygon starting point adjusted (this is cosmetic - your region coverage is identical)'
        )
      }
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
    // Handle ICESat-2 beams (array of strings like "gt1l" or numbers like 10)
    if (Array.isArray(data.beams)) {
      store.setEnableGranuleSelection(true)
      const matched = mapGtStringsToSrListNumberItems(data.beams)
      store.setSelectedGtOptions(matched)
      const unmatched = data.beams.filter(
        (beam: string | number) => !matched.some((gt) => gt.label === beam || gt.value === beam)
      )
      if (unmatched.length > 0) {
        logger.debug(`Unrecognized beam values skipped: ${unmatched.join(', ')}`)
        _addError('beams', 'Some beam values were not recognized and skipped (check input file)')
      }
      // Warn user that string beam names will be converted to numeric values on export
      if (matched.length > 0 && data.beams.some((b: unknown) => typeof b === 'string')) {
        const beamConversions = matched.map((gt) => `"${gt.label}" → ${gt.value}`).join(', ')
        logger.debug(`Beam string names will be exported as numeric values: ${beamConversions}`)
        _addError(
          'beams',
          `Beam names will be converted to numeric format on export: ${beamConversions}`
        )
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
      logger.debug(`Unrecognized track values skipped: ${unmatched.join(', ')}`)
      _addError('tracks', 'Some track values were not recognized and skipped (check input file)')
    }
  }

  // Handle GEDI-specific quality filter parameters
  // Current naming: degrade_filter, l2_quality_filter, etc.
  // Also accepts legacy short names (degrade, l2_quality, etc.) for backwards compatibility
  if (data.degrade_filter !== undefined) {
    store.degradeFlag = data.degrade_filter
  } else if (data.degrade !== undefined) {
    store.degradeFlag = data.degrade
    logger.debug('Legacy parameter conversion: degrade → degrade_filter')
    _addError(
      'degrade',
      'Parameter name updated: "degrade" is now "degrade_filter" (your settings were preserved)'
    )
  }
  if (data.l2_quality_filter !== undefined) {
    store.l2QualityFlag = data.l2_quality_filter
  } else if (data.l2_quality !== undefined) {
    store.l2QualityFlag = data.l2_quality
    logger.debug('Legacy parameter conversion: l2_quality → l2_quality_filter')
    _addError(
      'l2_quality',
      'Parameter name updated: "l2_quality" is now "l2_quality_filter" (your settings were preserved)'
    )
  }
  if (data.l4_quality_filter !== undefined) {
    store.l4QualityFlag = data.l4_quality_filter
  } else if (data.l4_quality !== undefined) {
    store.l4QualityFlag = data.l4_quality
    logger.debug('Legacy parameter conversion: l4_quality → l4_quality_filter')
    _addError(
      'l4_quality',
      'Parameter name updated: "l4_quality" is now "l4_quality_filter" (your settings were preserved)'
    )
  }
  if (data.surface_flag !== undefined) {
    store.surfaceFlag = data.surface_flag
  } else if (data.surface !== undefined) {
    store.surfaceFlag = data.surface
    logger.debug('Legacy parameter conversion: surface → surface_flag')
    _addError(
      'surface',
      'Parameter name updated: "surface" is now "surface_flag" (your settings were preserved)'
    )
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
    // Only warn if current API won't export this field
    const api = store.iceSat2SelectedAPI
    const willExport = api === 'atl08p' || (api === 'atl03x' && store.enablePhoReal)
    if (!willExport) {
      _addError(
        'atl08_fields',
        'Only exported for atl08p or atl03x-phoreal APIs - select one of these APIs or this field will be missing'
      )
    }
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
    // Only warn if current API won't export this field
    if (store.iceSat2SelectedAPI !== 'atl13x') {
      _addError(
        'atl13_fields',
        'Only exported for atl13x API - select atl13x or this field will be missing'
      )
    }
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
    // Only warn if pass_invalid is true (meaning cnt won't be exported)
    if (store.passInvalid) {
      _addError(
        'cnt',
        'Only exported when pass_invalid is false - set pass_invalid to false or this field will be missing'
      )
    }
  }
  if (data.ats !== undefined) {
    store.setUseAlongTrackSpread(true)
    coerce('ats', data.ats, (v) => store.setAlongTrackSpread(v[0]))
    // Only warn if pass_invalid is true (meaning ats won't be exported)
    if (store.passInvalid) {
      _addError(
        'ats',
        'Only exported when pass_invalid is false - set pass_invalid to false or this field will be missing'
      )
    }
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
      logger.debug(`Invalid srt value: ${JSON.stringify(data.srt)}`)
      _addError('srt', 'Surface reference type value was invalid and not applied')
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
  if (data.proj !== undefined) {
    store.useProj = true
    store.projValue = data.proj
  }
  if (data.cluster_size_hint !== undefined) {
    store.useClusterSizeHint = true
    store.clusterSizeHintValue = data.cluster_size_hint
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
    // Handle both classification (legacy) and class_ph (current)
    if (data.atl24.classification !== undefined) {
      store.useAtl24Classification = true
      const result = convertClassificationToStrings(data.atl24.classification)
      store.atl24_class_ph = result.values
      logger.debug('Legacy parameter conversion: atl24.classification → atl24.class_ph')
      _addError(
        'atl24.classification',
        'Parameter name updated: "classification" is now "class_ph" (your settings were preserved)'
      )
      if (result.conversions.length > 0) {
        const conversionList = result.conversions.map((c) => `${c.from} → "${c.to}"`).join(', ')
        _addError('atl24.classification', `Numeric values converted to names: ${conversionList}`)
      }
    }
    if (data.atl24.class_ph !== undefined) {
      store.useAtl24Classification = true
      // class_ph can contain numbers or strings, convert all to strings
      const result = convertClassificationToStrings(data.atl24.class_ph)
      store.atl24_class_ph = result.values
      if (result.conversions.length > 0) {
        const conversionList = result.conversions.map((c) => `${c.from} → "${c.to}"`).join(', ')
        _addError('atl24.class_ph', `Numeric values converted to names: ${conversionList}`)
      }
    }
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
    // Only warn if current API won't export atl24 parameters
    if (store.iceSat2SelectedAPI !== 'atl24x') {
      _addError(
        'atl24',
        'Only exported for atl24x API - select atl24x or this field will be missing'
      )
    }
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
        logger.debug('Legacy parameter conversion: fit.H_min_win → fit.h_win')
        _addError(
          'fit.H_min_win',
          'Parameter name updated: "H_min_win" is now "h_win" (your settings were preserved)'
        )
      }
      // Accept both sigma_r (current) and sigma_r_max (legacy)
      if ('sigma_r' in data.fit) {
        store.setUseMaxRobustDispersion(true)
        store.setSigmaRmax(data.fit.sigma_r)
      } else if ('sigma_r_max' in data.fit) {
        store.setUseMaxRobustDispersion(true)
        store.setSigmaRmax(data.fit.sigma_r_max)
        logger.debug('Legacy parameter conversion: fit.sigma_r_max → fit.sigma_r')
        _addError(
          'fit.sigma_r_max',
          'Parameter name updated: "sigma_r_max" is now "sigma_r" (your settings were preserved)'
        )
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

  // Validate API-specific required parameters
  // Warn if the selected API requires specific parameters but they're missing from the import
  const selectedApi = store.iceSat2SelectedAPI
  if (selectedApi === 'atl03x-surface' || selectedApi === 'atl06p') {
    if (data.fit === undefined) {
      _addError(
        'fit',
        'The "fit" parameter is required for surface fitting APIs (atl03x-surface, atl06p) - add fit:{} to enable surface fitting'
      )
    }
  } else if (selectedApi === 'atl03x-phoreal') {
    if (data.phoreal === undefined) {
      _addError(
        'phoreal',
        'The "phoreal" parameter is required for PhoREAL API (atl03x-phoreal) - add phoreal:{} to enable vegetation analysis'
      )
    }
  } else if (selectedApi === 'atl24x') {
    if (data.atl24 === undefined) {
      _addError(
        'atl24',
        'The "atl24" parameter is required for ATL24 API - add atl24:{} to enable bathymetry classification'
      )
    }
  } else if (selectedApi === 'atl13x') {
    if (data.atl13 === undefined) {
      _addError(
        'atl13',
        'The "atl13" parameter is required for ATL13 API - add atl13:{"coord":null} to enable inland water body analysis'
      )
    }
  }

  function coerce(field: string, _input: unknown, assign: (_v: number[]) => void) {
    const { valid, invalid, conversions } = coerceToNumberArray(_input)
    assign(valid)
    if (conversions.length > 0) {
      const conversionList = conversions.map((c) => `"${c.from}" → ${c.to}`).join(', ')
      logger.debug(`String ${field} values converted to numbers: ${conversionList}`)
      _addError(field, `String values converted to numbers: ${conversionList}`)
    }
    if (invalid.length > 0) {
      logger.debug(`Invalid ${field} values skipped: ${invalid.join(', ')}`)
      _addError(
        field,
        `Some ${field} values were invalid and skipped (check input file and endpoint selection)`
      )
    }
  }
}
