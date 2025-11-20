import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useChartStore } from './chartStore'
import { createDuckDbClient } from '@/utils/SrDuckDb'
import { db } from '@/db/SlideRuleDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('FieldNameStore')

const curGedi2apElFieldOptions = ref(['elevation_lm', 'elevation_hr'])
const curGedi2apElevationField = ref('elevation_lm')

function getHFieldNameForAPIStr(funcStr: string): string {
  //console.log('getHFieldNameForAPIStr',funcStr);
  switch (funcStr) {
    case 'atl06':
    case 'atl06p':
      return 'h_mean'
    case 'atl06s':
    case 'atl06sp':
      return 'h_li'
    case 'atl03vp':
      return 'segment_ph_cnt'
    case 'atl03s':
    case 'atl03sp':
      return 'height'
    case 'atl03x-surface':
      return 'h_mean'
    case 'atl03x-phoreal':
      return 'h_mean_canopy'
    case 'atl03x':
      return 'height'
    case 'atl08':
    case 'atl08p':
      return 'h_mean_canopy'
    case 'atl24x':
      return 'ortho_h'
    case 'gedi02ap':
    case 'gedi02a':
      return curGedi2apElevationField.value
    case 'gedi04ap':
    case 'gedi04a':
      return 'elevation'
    case 'gedi01bp':
    case 'gedi01b':
      return 'elevation_start'
    case 'atl13x':
      return 'ht_ortho'
    default:
      console.trace(`Unknown height fieldname for API: ${funcStr} in getHFieldNameForAPIStr`)
      throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldNameForAPIStr`)
  }
}

function getMissionFromApiStr(apiStr: string): string {
  if (apiStr.startsWith('atl')) return 'ICESat-2'
  else if (apiStr.startsWith('gedi')) return 'GEDI'
  else throw new Error(`Unknown mission for API: ${apiStr} in getMissionFromApiStr`)
}

function getMissionForReqId(reqId: number): string {
  if (reqId <= 0) return 'ICESat-2' // Default to ICESat-2 for invalid reqId
  const funcStr = useRecTreeStore().findApiForReqId(reqId)
  if (funcStr) {
    return getMissionFromApiStr(funcStr)
  } else {
    logger.debug('No API found in getMissionForReqId (reactivity should retry when loaded)', {
      reqId,
      funcStr
    })
    return 'ICESat-2' // Default to ICESat-2 if no API found
  }
}

function getDefaultElOptions(reqId: number, funcStr?: string): string[] {
  //We dont want to include all the fields in the file just the relavent ones

  //console.log(`getDefaultElOptions request for ${reqId}`);
  // If funcStr not provided, try to get it from tree (may be empty during race condition)
  if (!funcStr) {
    funcStr = useRecTreeStore().findApiForReqId(reqId)
  }
  let options = [] as string[]

  // Handle case where tree data isn't loaded yet and no funcStr provided
  if (!funcStr) {
    logger.warn('getDefaultElOptions: No API found (tree may not be loaded yet)', { reqId })
    return options // Return empty array
  }

  switch (funcStr) {
    case 'atl06':
    case 'atl06p':
    case 'atl03x-surface':
      options = [
        'h_mean',
        'rms_misfit',
        'h_sigma',
        'n_fit_photons',
        'dh_fit_dx',
        'pflags',
        'w_surface_window_final',
        'y_atc',
        'cycle',
        'srcid'
      ]
      break
    case 'atl06s':
    case 'atl06sp':
      options = ['h_li', 'y_atc', 'cycle', 'srcid']
      break
    case 'atl03vp':
      options = ['segment_ph_cnt']
      break
    case 'atl03s':
    case 'atl03sp':
      options = ['height', 'atl03_cnf', 'atl08_class', 'y_atc', 'cycle', 'srcid']
      break
    case 'atl03x':
      options = ['height', 'atl03_cnf', 'y_atc', 'cycle', 'srcid', 'yapc_score']
      break
    case 'atl08':
    case 'atl08p':
    case 'atl03x-phoreal':
      options = [
        'h_mean_canopy',
        'h_max_canopy',
        'h_canopy',
        'h_min_canopy',
        'h_te_median',
        'canopy_openness',
        'cycle',
        'srcid'
      ]
      break
    case 'atl24x':
      options = ['ortho_h', 'confidence', 'class_ph', 'y_atc', 'cycle', 'srcid']
      break
    case 'atl13x':
      options = ['ht_ortho', 'ht_water_surf', 'stdev_water_surf', 'water_depth', 'cycle', 'srcid']
      break
    case 'gedi02ap':
    case 'gedi02a':
      options = ['elevation_lm', 'elevation_hr', 'track', 'beam', 'orbit']
      break
    case 'gedi04ap':
    case 'gedi04a':
      options = ['elevation', 'track', 'beam', 'orbit']
      break
    case 'gedi01bp':
    case 'gedi01b':
      options = ['elevation_start', 'track', 'beam', 'orbit']
      break
    default:
      logger.error('getDefaultElOptions: Unknown API', { funcStr, reqId })
      //throw new Error(`Unknown height fieldname for API: ${funcStr} in getDefaultElOptions`);
      break
  }
  const fieldNames = useChartStore().getElevationDataOptions(reqId.toString())
  if (fieldNames.includes('atl24_class')) {
    logger.debug('getDefaultElOptions adding atl24_class', { fieldNames })
    options.push('atl24_class')
  }
  if (fieldNames.includes('atl08_class')) {
    logger.debug('getDefaultElOptions adding atl08_class', { fieldNames })
    options.push('atl08_class')
  }
  logger.debug('getDefaultElOptions request', { reqId, funcStr, options })
  return options
}

function getLatFieldNameForAPIStr(funcStr: string): string {
  return funcStr === 'atl24x' ? 'lat_ph' : 'latitude'
}

function getLonFieldNameForAPIStr(funcStr: string): string {
  return funcStr === 'atl24x' ? 'lon_ph' : 'longitude'
}

function getTimeFieldNameForAPIStr(funcStr: string): string {
  logger.debug('getTimeFieldNameForAPIStr', { funcStr })
  return funcStr.includes('x') ? 'time_ns' : 'time'
}

function getUniqueTrkFieldNameForAPIStr(funcStr: string): string {
  if (funcStr.includes('atl')) {
    return 'rgt'
  } else if (funcStr.includes('gedi')) {
    // GEDI APIs have different field names for track
    return 'track'
  } else {
    throw new Error(`Unknown rgt/track fieldname for API: ${funcStr} in getUniqueTrkFieldName`)
  }
}

function getUniqueTrkFieldName(reqId: number): string {
  const funcStr = useRecTreeStore().findApiForReqId(reqId)
  try {
    const field = getUniqueTrkFieldNameForAPIStr(funcStr)
    return field
  } catch (error) {
    logger.error('Field name lookup error', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

function getUniqueOrbitIdFieldNameForAPIStr(funcStr: string): string {
  if (funcStr.includes('atl')) {
    return 'cycle'
  } else if (funcStr.includes('gedi')) {
    return 'orbit'
  } else {
    throw new Error(
      `Unknown UniqueOrbitId fieldname for API: ${funcStr} in getUniqueOrbitIdFieldName`
    )
  }
}
function getUniqueOrbitIdFieldName(reqId: number): string {
  const funcStr = useRecTreeStore().findApiForReqId(reqId)
  try {
    const field = getUniqueOrbitIdFieldNameForAPIStr(funcStr)
    return field
  } catch (error) {
    logger.error('Field name lookup error', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

function getUniqueSpotIdFieldNameForAPIStr(funcStr: string): string {
  if (funcStr.includes('atl')) {
    return 'spot'
  } else if (funcStr.includes('gedi')) {
    return 'beam'
  } else {
    throw new Error(
      `Unknown UniqueSpotId fieldname for API: ${funcStr} in getUniqueSpotIdFieldName`
    )
  }
}
function getUniqueSpotIdFieldName(reqId: number): string {
  const funcStr = useRecTreeStore().findApiForReqId(reqId)
  try {
    const field = getUniqueSpotIdFieldNameForAPIStr(funcStr)
    return field
  } catch (error) {
    logger.error('Field name lookup error', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

function getDefaultColorEncoding(funcStr: string, parentFuncStr?: string): string {
  try {
    //console.log('getDefaultColorEncoding',funcStr,parentFuncStr);
    if (funcStr === 'atl03sp') {
      return 'atl03_cnf'
    } else if (funcStr === 'atl03x') {
      if (parentFuncStr === 'atl24x') return 'atl24_class'
      else return 'atl03_cnf'
    } else {
      return getHFieldNameForAPIStr(funcStr)
    }
  } catch (error) {
    logger.error('getDefaultColorEncoding error', {
      funcStr,
      error: error instanceof Error ? error.message : String(error)
    })
    return 'solid'
  }
}

interface RecordInfo {
  time?: string
  x: string
  y: string
  z?: string
}

export const useFieldNameStore = defineStore('fieldNameStore', () => {
  const hFieldCache = ref<Record<number, string>>({})
  const latFieldCache = ref<Record<number, string>>({})
  const lonFieldCache = ref<Record<number, string>>({})
  const timeFieldCache = ref<Record<number, string>>({})
  const recordInfoCache = ref<Record<number, RecordInfo | null>>({})
  const asGeoCache = ref<Record<number, boolean>>({})

  const recTreeStore = useRecTreeStore()

  /**
   * Fetch recordinfo metadata from parquet file for a given reqId
   * This will cache the result to avoid repeated DB queries
   */
  async function cacheRecordInfoForReqId(reqId: number): Promise<void> {
    //console.log(`cacheRecordInfoForReqId: reqId ${reqId}`);
    if (reqId <= 0) {
      logger.warn('Invalid reqId in cacheRecordInfoForReqId', { reqId })
      return
    }

    try {
      // Get filename for this reqId
      const fileName = await db.getFilename(reqId)
      if (!fileName) {
        logger.warn('No filename found for reqId', { reqId })
        recordInfoCache.value[reqId] = null
        return
      }

      // Get DuckDB client and read metadata
      const duckDb = await createDuckDbClient()
      await duckDb.insertOpfsParquet(fileName)
      const metadata = await duckDb.getAllParquetMetadata(fileName)

      if (metadata?.recordinfo) {
        const recordInfo: RecordInfo = JSON.parse(metadata.recordinfo)
        logger.debug('Loaded recordinfo metadata', { reqId, recordInfo })
        recordInfoCache.value[reqId] = recordInfo
        return
      } else {
        logger.debug('No recordinfo metadata found', { reqId })
        recordInfoCache.value[reqId] = null
        return
      }
    } catch (error) {
      logger.warn('Error fetching recordinfo', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
      recordInfoCache.value[reqId] = null
      return
    }
  }

  function getCachedValue(
    cache: Record<number, string>,
    reqId: number,
    getField: (_funcStr: string) => string
  ): string {
    if (cache[reqId]) return cache[reqId]
    const funcStr = recTreeStore.findApiForReqId(reqId)
    try {
      const field = getField(funcStr)
      cache[reqId] = field
      return field
    } catch (error) {
      logger.error('Field name lookup error', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Synchronous field name getters - these check recordinfo cache first (if pre-loaded),
   * then fall back to hardcoded values. Call loadMetaForReqId() first to populate cache.
   */
  function getHFieldName(reqId: number): string {
    // Check if we have recordinfo in cache
    const recordInfo = recordInfoCache.value[reqId]
    if (recordInfo && recordInfo.z) {
      hFieldCache.value[reqId] = recordInfo.z
      return recordInfo.z
    } else {
      if (recordInfo) {
        logger.debug('Recordinfo found but no z field', { reqId, recordInfo })
      } else {
        logger.debug('No recordinfo found in getHFieldName for reqId:', { reqId })
      }
    }
    logger.debug('No z field in recordinfo, falling back to hardcoded', { reqId })
    // Fall back to hardcoded
    return getCachedValue(hFieldCache.value, reqId, getHFieldNameForAPIStr)
  }

  function getLatFieldName(reqId: number): string {
    // Check if we have recordinfo in cache
    const recordInfo = recordInfoCache.value[reqId]
    if (recordInfo && recordInfo.y) {
      latFieldCache.value[reqId] = recordInfo.y
      return recordInfo.y
    }
    logger.debug('No y field in recordinfo, falling back to hardcoded', { reqId })
    // Fall back to hardcoded
    return getCachedValue(latFieldCache.value, reqId, getLatFieldNameForAPIStr)
  }

  function getLonFieldName(reqId: number): string {
    // Check if we have recordinfo in cache
    const recordInfo = recordInfoCache.value[reqId]
    if (recordInfo && recordInfo.x) {
      lonFieldCache.value[reqId] = recordInfo.x
      return recordInfo.x
    }
    logger.debug('No x field in recordinfo, falling back to hardcoded', { reqId })
    // Fall back to hardcoded
    return getCachedValue(lonFieldCache.value, reqId, getLonFieldNameForAPIStr)
  }

  function getTimeFieldName(reqId: number): string {
    // Check if we have recordinfo in cache
    const recordInfo = recordInfoCache.value[reqId]
    if (recordInfo && recordInfo.time) {
      timeFieldCache.value[reqId] = recordInfo.time
      return recordInfo.time
    }
    logger.debug('No time field in recordinfo, falling back to hardcoded', { reqId })
    // Fall back to hardcoded
    return getCachedValue(timeFieldCache.value, reqId, getTimeFieldNameForAPIStr)
  }

  /**
   * Extract as_geo value from X-API format (output.as_geo)
   */
  function extractAsGeoFromXApi(svrParams: any, reqId: number): boolean {
    if (svrParams.output && typeof svrParams.output === 'object') {
      if (svrParams.output.as_geo !== undefined) {
        const asGeo = svrParams.output.as_geo === true
        logger.debug('extractAsGeoFromXApi: output.as_geo', {
          reqId,
          asGeo,
          output: svrParams.output
        })
        return asGeo
      } else {
        logger.error('extractAsGeoFromXApi: output.as_geo undefined, defaulting to false', {
          reqId,
          output: svrParams.output
        })
        return false
      }
    } else {
      logger.error(
        'extractAsGeoFromXApi: output field missing or invalid, defaulting as_geo to false',
        { reqId, output: svrParams.output }
      )
      return false
    }
  }

  /**
   * Extract as_geo value from non-X-API format (server.rqst.parms.output.as_geo)
   */
  function extractAsGeoFromNonXApi(svrParams: any, reqId: number): boolean {
    if (svrParams.server && typeof svrParams.server === 'object') {
      if (svrParams.server.rqst && typeof svrParams.server.rqst === 'object') {
        if (svrParams.server.rqst.parms && typeof svrParams.server.rqst.parms === 'object') {
          if (
            svrParams.server.rqst.parms.output &&
            typeof svrParams.server.rqst.parms.output === 'object'
          ) {
            if (svrParams.server.rqst.parms.output.as_geo !== undefined) {
              const asGeo = svrParams.server.rqst.parms.output.as_geo === true
              logger.debug('extractAsGeoFromNonXApi: output.as_geo', {
                reqId,
                asGeo,
                output: svrParams.server.rqst.parms.output
              })
              return asGeo
            } else {
              logger.error(
                'extractAsGeoFromNonXApi: output.as_geo undefined, defaulting to false',
                { reqId, output: svrParams.server.rqst.parms.output }
              )
              return false
            }
          } else {
            logger.error(
              'extractAsGeoFromNonXApi: output field missing or invalid, defaulting as_geo to false',
              { reqId, output: svrParams.server.rqst.parms.output }
            )
            return false
          }
        } else {
          logger.error(
            'extractAsGeoFromNonXApi: parms field missing or invalid, defaulting as_geo to false',
            { reqId, parms: svrParams.server.rqst.parms }
          )
          return false
        }
      } else {
        logger.error(
          'extractAsGeoFromNonXApi: rqst field missing or invalid, defaulting as_geo to false',
          { reqId, rqst: svrParams.server.rqst }
        )
        return false
      }
    } else {
      logger.error(
        'extractAsGeoFromNonXApi: server field missing or invalid, defaulting as_geo to false',
        { reqId, server: svrParams.server }
      )
      return false
    }
  }

  /**
   * Set asGeoCache based on server parameters structure
   * X-APIs store as_geo at output.as_geo
   * Non-X-APIs store as_geo at server.rqst.parms.output.as_geo
   */
  function setAsGeoCache(reqId: number, svrParams: any, funcStr: string): void {
    if (!svrParams) {
      logger.error('setAsGeoCache: svrParams is null/undefined', { reqId })
      asGeoCache.value[reqId] = false
      return
    }

    if (!funcStr) {
      logger.error('setAsGeoCache: request.func is null/undefined', { reqId })
      asGeoCache.value[reqId] = false
      return
    }

    if (funcStr.includes('x')) {
      asGeoCache.value[reqId] = extractAsGeoFromXApi(svrParams, reqId)
    } else {
      asGeoCache.value[reqId] = extractAsGeoFromNonXApi(svrParams, reqId)
    }
  }

  /**
   * Load as_geo flag from server parameters for a given reqId
   * This checks the output.as_geo field from the request's server parameters
   */
  async function loadAsGeoFromSvrParams(reqId: number): Promise<void> {
    try {
      const request = await db.getRequest(reqId)
      if (!request) {
        logger.error('loadAsGeoFromSvrParams: No request found', { reqId })
        asGeoCache.value[reqId] = false
        return
      }
      let svrParams = request.svr_parms
      //console.log(`[fieldNameStore] loadAsGeoFromSvrParams for reqId ${reqId}:`, svrParams);
      //console.log(`[fieldNameStore] typeof svrParams:`, typeof svrParams);

      // If svrParams is a string, parse it
      if (typeof svrParams === 'string') {
        svrParams = JSON.parse(svrParams)
        logger.debug('loadAsGeoFromSvrParams: Parsing svrParams string', { reqId, svrParams })
      }

      setAsGeoCache(reqId, svrParams, request.func || '')
    } catch (error) {
      logger.error('loadAsGeoFromSvrParams: Error loading as_geo from server params', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
      asGeoCache.value[reqId] = false
    }
  }

  /**
   * Check if the parquet file for a given reqId is in GeoParquet format.
   * This checks the as_geo property from the server parameters.
   * Returns false if not cached.
   */
  function isGeoParquet(reqId: number): boolean {
    return asGeoCache.value[reqId] === true
  }

  /**
   * Async function to pre-load recordinfo metadata for a reqId.
   * Call this early (e.g., after loading a parquet file) to populate the cache,
   * so that subsequent synchronous getters can use recordinfo values.
   */
  async function loadMetaForReqId(reqId: number): Promise<void> {
    try {
      await loadAsGeoFromSvrParams(reqId)
    } catch (error) {
      logger.warn('Error loading as_geo', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    try {
      await cacheRecordInfoForReqId(reqId)
    } catch (error) {
      logger.warn('Error loading recordinfo', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    getHFieldName,
    getLatFieldName,
    getLonFieldName,
    getTimeFieldName,
    getDefaultColorEncoding,
    getDefaultElOptions,
    getMissionForReqId,
    getMissionFromApiStr,
    getUniqueTrkFieldName,
    getUniqueOrbitIdFieldName,
    getUniqueSpotIdFieldName,
    curGedi2apElFieldOptions,
    curGedi2apElevationField,
    isGeoParquet,
    loadAsGeoFromSvrParams,
    // for debugging/testing
    hFieldCache,
    latFieldCache,
    lonFieldCache,
    timeFieldCache,
    recordInfoCache,
    asGeoCache,
    cacheRecordInfoForReqId,
    loadMetaForReqId
  }
})
