import type { SrRequestSummary } from '@/db/SlideRuleDb'
import { createDuckDbClient, type QueryResult } from '@/utils//SrDuckDb'
import { db as indexedDb } from '@/db/SlideRuleDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDuckDbUtils')
import type { ExtHMean, ExtLatLon } from '@/workers/workerUtils'
import { updateDeckLayerWithObject, type ElevationDataItem } from '@/utils/SrMapUtils'
import { useCurReqSumStore } from '@/stores/curReqSumStore'
import { SrMutex } from '@/utils/SrMutex'
import { useSrToastStore } from '@/stores/srToastStore'
import { srViews } from '@/composables/SrViews'
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore'
import { useChartStore } from '@/stores/chartStore'
import type { MinMaxLowHigh, SrListNumberItem } from '@/types/SrTypes'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { isClickable } from '@/utils/SrMapUtils'
import { createWhereClause } from '@/utils/spotUtils'
import { type SrPosition } from '@/types/SrTypes'
import { useAnalysisMapStore } from '@/stores/analysisMapStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import {
  baseType,
  alias,
  FLOAT_TYPES,
  INT_TYPES,
  DECIMAL_TYPES,
  BOOL_TYPES,
  TEMPORAL_TYPES,
  buildSafeAggregateClauses,
  getGeometryInfo,
  getGeometryInfoWithTypes
} from '@/utils/duckAgg'
import {
  extractCrsFromGeoMetadata,
  transformCoordinate,
  needsTransformation
} from '@/utils/SrCrsTransform'

interface SummaryRowData {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  minHMean: number
  maxHMean: number
  lowHMean: number
  highHMean: number
  numPoints: number
}
const srMutex = new SrMutex()
function aliasKey(prefix: string, colName: string): string {
  return alias(prefix, colName)
}

/**
 * Safely convert a value to a number, handling BigInt values.
 * For statistical operations (min/max/etc), returns NaN if BigInt is too large.
 * This prevents crashes while indicating the value can't be used for math operations.
 */
function safeToNumber(value: any): number {
  if (typeof value === 'bigint') {
    // Check if the BigInt is within JavaScript's safe integer range
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      // Return NaN for statistical operations - this field shouldn't be used for min/max
      return NaN
    }
    return Number(value)
  }
  return value
}

/**
 * Converts a value to a number or string, handling BigInt values intelligently.
 * For BigInt values outside safe range, converts to string for display purposes.
 * This allows identifier fields like shot_number to be displayed/plotted as strings.
 */
function valueToNumberOrString(value: any): number | string {
  if (typeof value === 'bigint') {
    // Check if the BigInt is within JavaScript's safe integer range
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      // Convert to string for display - this is likely an identifier field
      return value.toString()
    }
    return Number(value)
  }
  return value
}
export const readOrCacheSummary = async (req_id: number): Promise<SrRequestSummary | undefined> => {
  try {
    const summary = await _duckDbReadOrCacheSummary(req_id)
    //console.log('readOrCacheSummary req_id:', req_id,'hfn:',height_fieldname, ' summary.extHMean:', summary?.extHMean);
    return summary
  } catch (error) {
    logger.error('Error reading or caching summary', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

async function setElevationDataOptionsFromFieldNames(
  reqId: number,
  fieldNames: string[],
  funcStr?: string
): Promise<void> {
  //console.log(`setElevationDataOptionsFromFieldNames reqId:${reqId}`, fieldNames );
  // const _startTime = performance.now() // Start time
  const chartStore = useChartStore()
  try {
    const reqIdStr = reqId.toString()
    const fncs = useFieldNameStore()

    // NOTE: Metadata (recordinfo) should already be loaded by prepareDbForReqId
    // calling loadMetaForReqId. If not, getHFieldName will fall back to hardcoded values.

    // If funcStr not provided, fall back to expensive database lookup
    if (!funcStr) {
      logger.warn('No funcStr provided, falling back to database', { reqId })
      const request = await indexedDb.getRequest(reqId)
      funcStr = request?.func || ''
      if (funcStr) {
        logger.debug('Retrieved func from database', { reqId, func: funcStr })
      }
    }

    // Update elevation data options in the chart store
    chartStore.setElevationDataOptions(reqIdStr, fieldNames)
    // Get the height field name
    let heightFieldname = fncs.getHFieldName(reqId)

    // Validate that the height field actually exists in the file
    // If not, the metadata is incorrect and we should use the hardcoded default
    if (!fieldNames.includes(heightFieldname)) {
      logger.warn('Height field from metadata not found in file columns, using hardcoded default', {
        heightFieldname,
        availableFields: fieldNames
      })
      // Get the hardcoded value by calling getHFieldName again (will now skip the cache)
      heightFieldname = fncs.getHFieldName(reqId)
      logger.debug('Using hardcoded height field', { heightFieldname })
    }

    // Find the index of the height field name
    const ndx = fieldNames.indexOf(heightFieldname)
    // Update the index of the elevation data options for height
    chartStore.setNdxOfElevationDataOptionsForHeight(reqIdStr, ndx)
    // Retrieve the existing Y data for the chart
    // Pass the func to avoid redundant lookups (from tree or database above)
    const defElOptions = fncs.getDefaultElOptions(reqId, funcStr)

    // Filter default options to only include those that actually exist in the file
    const validDefElOptions = defElOptions.filter((option) => fieldNames.includes(option))

    if (validDefElOptions.length !== defElOptions.length) {
      const missingOptions = defElOptions.filter((option) => !fieldNames.includes(option))
      logger.debug('Some default elevation options not present in file', {
        reqId,
        totalDefault: defElOptions.length,
        validCount: validDefElOptions.length,
        missingCount: missingOptions.length,
        missingOptions
      })
    }

    for (const elevationOption of validDefElOptions) {
      const existingYdata = chartStore.getYDataOptions(reqIdStr)
      // Check if the elevation option is already in the Y data
      if (!existingYdata.includes(elevationOption)) {
        // Clone the existing Y data and add the new elevation option
        const newYdata = [...existingYdata, elevationOption]
        // Update the Y data for the chart
        chartStore.setYDataOptions(reqIdStr, newYdata)
      }
    }

    // Set selected Y data to height field if it exists in the file, otherwise use first available field
    let selectedYField = heightFieldname
    if (!fieldNames.includes(heightFieldname)) {
      // Height field doesn't exist - use first available numeric field
      selectedYField = fieldNames[0] || ''
      logger.warn('Height field not found in file, using first available field', {
        reqId,
        heightFieldname,
        selectedYField,
        availableFields: fieldNames
      })
    }
    chartStore.setSelectedYData(reqIdStr, selectedYField)
    //console.log('setElevationDataOptionsFromFieldNames', { reqIdStr, fieldNames, heightFieldname, ndx } );
  } catch (error) {
    logger.error('Error setting elevation data options from field names', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    // const _endTime = performance.now() // End time
    //console.log(`setElevationDataOptionsFromFieldNames using reqId:${reqIdStr} fieldNames:${fieldNames} selectedYData:${chartStore.getSelectedYData(reqIdStr)} took ${_endTime - _startTime} milliseconds.`);
  }
}

async function _duckDbReadOrCacheSummary(req_id: number): Promise<SrRequestSummary | undefined> {
  const startTime = performance.now()
  let summary: SrRequestSummary | undefined = undefined
  const unlock = await srMutex.lock()
  let rsummary: SrRequestSummary | undefined = undefined

  try {
    summary = await indexedDb.getWorkerSummary(req_id)
    if (summary?.extLatLon && summary?.extHMean) {
      rsummary = summary
      return rsummary
    }

    const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 }
    const localExtHMean: ExtHMean = {
      minHMean: 1e6,
      maxHMean: -1e6,
      lowHMean: 1e6,
      highHMean: -1e6
    }

    // Get all geometry and type info in one call
    const {
      geometryInfo,
      colTypes: _colTypes,
      getType,
      fileName,
      duckDbClient
    } = await getGeometryInfoWithTypes(req_id)

    const fieldNameStore = useFieldNameStore()
    const height_fieldname = fieldNameStore.getHFieldName(req_id)
    const lat_fieldname = fieldNameStore.getLatFieldName(req_id)
    const lon_fieldname = fieldNameStore.getLonFieldName(req_id)

    // console.log(`_duckDbReadOrCacheSummary req_id:${req_id} DEBUG:`, {
    //     height_fieldname,
    //     lat_fieldname,
    //     lon_fieldname,
    //     geometryInfo,
    //     hasGeometry: geometryInfo?.hasGeometry,
    //     colTypes: colTypes.map(c => c.name)
    // });

    const aggCols = [lat_fieldname, lon_fieldname, height_fieldname]
    const aggClauses = buildSafeAggregateClauses(
      aggCols,
      getType,
      duckDbClient.escape,
      geometryInfo
    )
    //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} aggClauses:`, aggClauses, ' geometryInfo:', geometryInfo);
    // Add COUNT(*) manually
    const summaryQuery = `
            SELECT
                ${aggClauses.join(',\n')},
                COUNT(*) AS numPoints
            FROM '${fileName}'
        `

    const results = await duckDbClient.query(summaryQuery)
    //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} summaryQuery:`, summaryQuery,' geometryInfo:', geometryInfo, ' results:', results);
    const rows: SummaryRowData[] = []

    for await (const chunk of results.readRows()) {
      for (const row of chunk) {
        //console.log(`_duckDbReadOrCacheSummary req_id:${req_id} RAW ROW:`, row);
        // console.log(`_duckDbReadOrCacheSummary req_id:${req_id} HEIGHT KEYS:`, {
        //     heightField: height_fieldname,
        //     minKey: aliasKey("min", height_fieldname),
        //     maxKey: aliasKey("max", height_fieldname),
        //     lowKey: aliasKey("low", height_fieldname),
        //     highKey: aliasKey("high", height_fieldname),
        //     minValue: row[aliasKey("min", height_fieldname)],
        //     maxValue: row[aliasKey("max", height_fieldname)],
        //     allKeys: Object.keys(row)
        // });

        const typedRow: SummaryRowData = {
          minLat: row[aliasKey('min', lat_fieldname)],
          maxLat: row[aliasKey('max', lat_fieldname)],
          minLon: row[aliasKey('min', lon_fieldname)],
          maxLon: row[aliasKey('max', lon_fieldname)],
          minHMean: row[aliasKey('min', height_fieldname)],
          maxHMean: row[aliasKey('max', height_fieldname)],
          lowHMean: row[aliasKey('low', height_fieldname)],
          highHMean: row[aliasKey('high', height_fieldname)],
          numPoints: row.numPoints
        }
        rows.push(typedRow)
      }
    }

    if (rows.length > 0) {
      const row = rows[0]
      localExtLatLon.minLat = row.minLat
      localExtLatLon.maxLat = row.maxLat
      localExtLatLon.minLon = row.minLon
      localExtLatLon.maxLon = row.maxLon
      localExtHMean.minHMean = row.minHMean
      localExtHMean.maxHMean = row.maxHMean
      localExtHMean.lowHMean = row.lowHMean
      localExtHMean.highHMean = row.highHMean

      summary = {
        req_id,
        extLatLon: localExtLatLon,
        extHMean: localExtHMean,
        numPoints: row.numPoints
      }
      await indexedDb.addNewSummary(summary)
      await indexedDb.updateRequestRecord({ req_id, cnt: row.numPoints }, false)
      useCurReqSumStore().setSummary(summary)
    } else {
      throw new Error('No rows returned')
    }

    rsummary = await indexedDb.getWorkerSummary(req_id)
    //console.log('_duckDbReadOrCacheSummary returning summary:', rsummary);
  } catch (error) {
    logger.error('Error in _duckDbReadOrCacheSummary', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    unlock()
    const endTime = performance.now()
    logger.debug('_duckDbReadOrCacheSummary performance', {
      reqId: req_id,
      durationMs: endTime - startTime
    })
  }
  return rsummary
}

export const computeSamplingRate = async (req_id: number): Promise<number> => {
  let sample_fraction = 1.0
  try {
    const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay()
    const summary = await readOrCacheSummary(req_id)
    if (summary) {
      const numPointsStr = summary.numPoints
      const numPoints = parseInt(String(numPointsStr))
      // console.log(`numPoints: ${numPoints}, Type: ${typeof numPoints}`);
      try {
        sample_fraction = maxNumPnts / numPoints
      } catch (error) {
        logger.error('Error calculating sample fraction', {
          reqId: req_id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      //console.warn('computeSamplingRate maxNumPnts:', maxNumPnts, ' summary.numPoints:', summary.numPoints, ' numPoints:',numPoints, ' sample_fraction:', sample_fraction);
    } else {
      logger.error('Summary is undefined, using sample fraction 1.0', { reqId: req_id })
    }
  } catch (error) {
    logger.error('Error computing sampling rate', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return sample_fraction
}

function isScalarNumericDuckType(type: string): boolean {
  const T = type.toUpperCase()
  // reject containers
  if (
    T.includes('LIST') ||
    T.includes('[]') ||
    T.startsWith('STRUCT') ||
    T.startsWith('MAP') ||
    T.startsWith('UNION')
  ) {
    return false
  }
  // allow numeric scalars
  return /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|REAL|FLOAT|DOUBLE|DECIMAL)/.test(
    T
  )
}

export async function prepareDbForReqId(reqId: number): Promise<void> {
  const startTime = performance.now()
  try {
    const fileName = await indexedDb.getFilename(reqId)
    const funcStr = await indexedDb.getFunc(reqId)
    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)

    // Load all metadata early (recordinfo + as_geo) to avoid race conditions
    // This ensures subsequent calls to getHFieldName, getLatFieldName, etc. use actual metadata
    const fieldNameStore = useFieldNameStore()
    await fieldNameStore.loadMetaForReqId(reqId)

    // Get typed columns and keep only scalar numerics (no arrays/lists)
    const colTypes = await duckDbClient.queryColumnTypes(fileName)
    const scalarNumericCols = colTypes
      .filter((c) => isScalarNumericDuckType(c.type))
      .map((c) => c.name)

    // Check if file has geometry column and add geometry-derived field names
    // These fields (height, longitude, latitude) are extracted at query time using ST_Z, ST_X, ST_Y
    // but don't exist as actual columns in the parquet file
    const geometryInfo = getGeometryInfo(colTypes, reqId)
    const fieldNamesForChart = [...scalarNumericCols]
    if (geometryInfo?.hasGeometry) {
      // Always add longitude and latitude since they're always extracted from geometry
      if (geometryInfo.xCol && !fieldNamesForChart.includes(geometryInfo.xCol)) {
        fieldNamesForChart.push(geometryInfo.xCol)
      }
      if (geometryInfo.yCol && !fieldNamesForChart.includes(geometryInfo.yCol)) {
        fieldNamesForChart.push(geometryInfo.yCol)
      }
      // Only add height if Z is stored in geometry (not as separate column)
      if (geometryInfo.zCol && !fieldNamesForChart.includes(geometryInfo.zCol)) {
        fieldNamesForChart.push(geometryInfo.zCol)
      }
    }

    await updateAllFilterOptions(reqId)
    //console.trace(`prepareDbForReqId reqId:${reqId} colNames:`, scalarNumericCols);
    // Use filtered names so arrays never reach the chart store
    // Pass funcStr to avoid circular dependency on recTreeStore
    await setElevationDataOptionsFromFieldNames(reqId, fieldNamesForChart, funcStr)
  } catch (error) {
    logger.error('Error preparing database for request', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now()
    logger.debug('prepareDbForReqId performance', { reqId, durationMs: endTime - startTime })
  }
}

//This is IceSat-2 specific
export const getColsForRgtYatcFromFile = async (
  req_id: number,
  cols: string[]
): Promise<Record<string, any[]> | undefined> => {
  if (!req_id) {
    logger.error('Invalid req_id in getColsForRgtYatcFromFile', { reqId: req_id, columns: cols })
    return
  }

  const startTime = performance.now()
  let numRows = 0
  const rowChunks: ElevationDataItem[] = []

  try {
    if ((await indexedDb.getStatus(req_id)) === 'error') {
      logger.error('Request status is error, skipping', { reqId: req_id, columns: cols })
      return
    }
    const globalChartStore = useGlobalChartStore()
    if (!globalChartStore.y_atc_is_valid()) {
      logger.error('y_atc is invalid, skipping', { reqId: req_id, columns: cols })
      return
    }
    // 1. Initialize DuckDB client
    const duckDbClient = await createDuckDbClient()

    // 2. Retrieve the filename/func
    const filename = await indexedDb.getFilename(req_id)
    const rgt = globalChartStore.getRgt()
    const selected_y_atc = globalChartStore.selected_y_atc
    const y_atc_margin = globalChartStore.y_atc_margin

    // 3. Build the query with (or without) DISTINCT
    //    If you want distinct *row combinations*, keep DISTINCT:
    //       SELECT DISTINCT col1, col2 FROM ...
    //    Or remove DISTINCT to see all matching rows:
    //       SELECT col1, col2 FROM ...
    //
    // Example removing DISTINCT:
    const columnStr = cols.join(', ')
    const queryStr = `
            SELECT DISTINCT ${columnStr}
            FROM read_parquet('${filename}')
            WHERE rgt = ${rgt}
            AND y_atc BETWEEN (${selected_y_atc} - ${y_atc_margin})
                            AND (${selected_y_atc} + ${y_atc_margin})
        `

    // 4. Register the Parquet
    await duckDbClient.insertOpfsParquet(filename)

    // 5. Execute the query
    const result = await duckDbClient.queryChunkSampled(queryStr)
    for await (const rowChunk of result.readRows()) {
      if (rowChunk.length > 0) {
        numRows += rowChunk.length
        rowChunks.push(...rowChunk)
      }
    }
  } catch (error) {
    logger.error('Error in getColsForRgtYatcFromFile', {
      reqId: req_id,
      columns: cols,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  // Log after processing
  if (numRows > 0) {
    logger.debug('Retrieved columns from file', { columns: cols, rowCount: numRows })
  } else {
    logger.warn('No data items processed', { reqId: req_id, columns: cols })
  }

  // ──────────────────────────────────────────
  // Transform row-based data → column-based data
  // ──────────────────────────────────────────
  if (numRows === 0) {
    return undefined
  }

  // Create an object that will store an array for each column
  const dataByColumn: Record<string, Set<any>> = {}
  cols.forEach((col) => (dataByColumn[col] = new Set()))

  // Populate these sets
  for (const row of rowChunks) {
    for (const col of cols) {
      dataByColumn[col].add(row[col])
    }
  }

  // Convert sets back to arrays
  const uniqueDataByColumn: Record<string, any[]> = {}
  for (const col of cols) {
    uniqueDataByColumn[col] = Array.from(dataByColumn[col])
  }

  const endTime = performance.now()
  logger.debug('getColsForRgtYatcFromFile performance', {
    columns: cols,
    reqId: req_id,
    rowCount: numRows,
    durationMs: endTime - startTime
  })
  return uniqueDataByColumn
}

export async function getRepresentativeElevationPointForReq(
  req_id: number
): Promise<ElevationDataItem | null> {
  const start = performance.now()
  try {
    const fileName = await indexedDb.getFilename(req_id)
    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)

    const fns = useFieldNameStore()
    const rgtCol = fns.getUniqueTrkFieldName(req_id)
    const cycleCol = fns.getUniqueOrbitIdFieldName(req_id)
    const spotCol = fns.getUniqueSpotIdFieldName(req_id)

    const esc = duckDbClient.escape

    const sql = `
      WITH top_combo AS (
        SELECT ${esc(rgtCol)} AS rgt, ${esc(cycleCol)} AS cycle, ${esc(spotCol)} AS spot
        FROM '${fileName}'
        GROUP BY ${esc(rgtCol)}, ${esc(cycleCol)}, ${esc(spotCol)}
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
      SELECT t.*
      FROM '${fileName}' t
      JOIN top_combo tc
        ON t.${esc(rgtCol)} = tc.rgt
       AND t.${esc(cycleCol)} = tc.cycle
       AND t.${esc(spotCol)} = tc.spot
      LIMIT 1;
    `

    const q = await duckDbClient.query(sql)
    for await (const chunk of q.readRows()) {
      if (chunk.length > 0) return chunk[0] as ElevationDataItem
    }
    return null
  } catch (err) {
    logger.error('Error getting representative elevation point', {
      reqId: req_id,
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  } finally {
    logger.debug('getRepresentativeElevationPointForReq performance', {
      reqId: req_id,
      durationMs: (performance.now() - start).toFixed(1)
    })
  }
}

export const duckDbReadAndUpdateElevationData = async (
  req_id: number,
  layerName: string
): Promise<ElevationDataItem | null> => {
  logger.debug('Reading and updating elevation data', { reqId: req_id, layerName })
  const startTime = performance.now()

  let firstRec: ElevationDataItem | null = null
  let numRows = 0
  let srViewName = await indexedDb.getSrViewName(req_id)

  if (!srViewName || srViewName === '' || srViewName === 'Global') {
    srViewName = 'Global Mercator Esri'
    logger.warn('HACK ALERT: Using fallback srViewName', { srViewName, reqId: req_id })
  }

  const projName = srViews.value[srViewName].projectionName

  if (!req_id) {
    logger.error('Invalid req_id in duckDbReadAndUpdateElevationData', { reqId: req_id })
    return null
  }

  const pntData = useAnalysisMapStore().getPntDataByReqId(req_id.toString())
  pntData.isLoading = true

  try {
    if ((await indexedDb.getStatus(req_id)) === 'error') {
      logger.error('Request status is error, skipping', { reqId: req_id })
      return null
    }

    const duckDbClient = await createDuckDbClient()
    const filename = await indexedDb.getFilename(req_id)
    await duckDbClient.insertOpfsParquet(filename)

    // ─────────────────────────────────────────────────────────
    // NEW: pick representative point from top (rgt,cycle,spot)
    //      default: median by x-axis (falls back internally)
    //      alternative: pass "strongest"
    // ─────────────────────────────────────────────────────────
    try {
      const rep = await getRepresentativeElevationPointForReq(req_id)
      if (rep) {
        firstRec = rep // <- set early; we still build/render the layer from chunks below
      }
    } catch (e) {
      logger.warn('Representative point selection failed, will fall back to first clickable row', {
        reqId: req_id,
        error: e instanceof Error ? e.message : String(e)
      })
    }

    let rows: ElevationDataItem[] = []
    let positions: SrPosition[] = [] // Precompute positions
    const pntDataLocal = useAnalysisMapStore().getPntDataByReqId(req_id.toString())
    pntDataLocal.totalPnts = 0
    pntDataLocal.currentPnts = 0

    // Get CRS information for coordinate transformation
    const geoMetadata = await getGeoMetadataFromFile(filename)
    const sourceCrs = extractCrsFromGeoMetadata(geoMetadata)
    const requiresTransformation = needsTransformation(sourceCrs)

    if (requiresTransformation && sourceCrs) {
      logger.debug('Will transform coordinates', { from: sourceCrs, to: 'EPSG:4326' })
    } else if (sourceCrs) {
      logger.debug('No transformation needed', { crs: sourceCrs })
    } else {
      logger.debug('No geo metadata CRS found, assuming WGS 84 (EPSG:4326)')
    }

    try {
      const sample_fraction = await computeSamplingRate(req_id)

      // Check if geometry column exists and build appropriate SELECT
      const colTypes = await duckDbClient.queryColumnTypes(filename)
      const hasGeometry = colTypes.some((c) => c.name === 'geometry')

      // Get field names from fieldNameStore
      const fieldNameStore = useFieldNameStore()
      const lonField = fieldNameStore.getLonFieldName(req_id)
      const latField = fieldNameStore.getLatFieldName(req_id)
      const heightField = fieldNameStore.getHFieldName(req_id)

      let selectClause: string
      if (hasGeometry) {
        // Check if Z column exists as a separate column
        // If it does, geometry is 2D (Point) and Z is stored separately
        // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
        const hasZColumn = colTypes.some((c) => c.name === heightField)
        const geometryHasZ = !hasZColumn // Z is in geometry if there's no separate Z column

        // Build column list: all columns except geometry (and z column if it's in geometry)
        const nonGeomCols = colTypes
          .filter((c) => {
            if (c.name === 'geometry') return false
            // If Z is in geometry, exclude the separate Z column
            if (geometryHasZ && c.name === heightField) return false
            return true
          })
          .map((c) => duckDbClient.escape(c.name))

        // Add geometry extractions with field name aliases
        const geomExtractions = [
          `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
          `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
        ]

        // Only extract Z from geometry if it has Z, otherwise include the separate column
        if (geometryHasZ) {
          geomExtractions.push(
            `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
          )
        } else {
          // Z is a separate column, already included in nonGeomCols
        }

        selectClause = [...nonGeomCols, ...geomExtractions].join(', ')
      } else {
        selectClause = '*'
      }

      const queryStr = `SELECT ${selectClause} FROM read_parquet('${filename}')`
      const result = await duckDbClient.queryChunkSampled(queryStr, sample_fraction)

      if (result.totalRows) {
        pntDataLocal.totalPnts = result.totalRows
      } else if (result.schema === undefined) {
        logger.warn('totalRows and schema are undefined', { reqId: req_id, result })
      }

      const iterator = result.readRows()
      const { value, done } = await iterator.next()

      if (!done && value) {
        rows = value as ElevationDataItem[]
        numRows = rows.length
        pntDataLocal.currentPnts = numRows

        // Fallback if representative point was not found
        if (!firstRec) {
          firstRec = rows.find(isClickable) || null
          if (!firstRec && rows.length > 0) {
            firstRec = rows[0]
          }
        }

        if (firstRec) {
          // Transform coordinates from source CRS to WGS 84 (EPSG:4326) if needed
          positions = rows.map((d) => {
            const lon = d[lonField]
            const lat = d[latField]

            if (requiresTransformation && sourceCrs) {
              const [transformedLon, transformedLat] = transformCoordinate(lon, lat, sourceCrs)
              return [transformedLon, transformedLat, 0] as SrPosition
            } else {
              return [lon, lat, 0] as SrPosition
            }
          })
        } else {
          logger.warn('No valid elevation points found', { reqId: req_id, numRows })
          useSrToastStore().warn(
            'No Data Processed',
            `No valid elevation points found in ${numRows} rows.`
          )
        }
      } else {
        logger.warn('No data items processed', { reqId: req_id })
        useSrToastStore().warn(
          'No Data Processed',
          'No data items processed. No Data returned for this region and request parameters.'
        )
      }
    } catch (error) {
      logger.error('Error processing chunk', {
        reqId: req_id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    if (numRows > 0 && firstRec) {
      const height_fieldname = useFieldNameStore().getHFieldName(req_id)
      const summary = await readOrCacheSummary(req_id)

      if (summary?.extHMean) {
        useCurReqSumStore().setSummary({
          req_id,
          extLatLon: summary.extLatLon,
          extHMean: summary.extHMean,
          numPoints: summary.numPoints
        })
        updateDeckLayerWithObject(
          layerName,
          rows,
          summary.extHMean,
          height_fieldname,
          positions,
          projName
        )
      } else {
        logger.error('Summary is undefined', { reqId: req_id })
      }

      await prepareDbForReqId(req_id)
    }
  } catch (error) {
    logger.error('Error in duckDbReadAndUpdateElevationData', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const pntDataFinal = useAnalysisMapStore().getPntDataByReqId(req_id.toString())
    pntDataFinal.isLoading = false
    const endTime = performance.now()
    logger.debug('duckDbReadAndUpdateElevationData performance', {
      reqId: req_id,
      durationMs: endTime - startTime
    })
  }
  return { firstRec, numRows }
}

type Position = [number, number, number]

export const duckDbReadAndUpdateSelectedLayer = async (req_id: number, layerName: string) => {
  logger.debug('Reading and updating selected layer', { reqId: req_id, layerName })
  if (req_id === undefined || req_id === null || req_id === 0) {
    logger.error('Invalid req_id in duckDbReadAndUpdateSelectedLayer', { reqId: req_id })
    return
  }

  const startTime = performance.now()
  const reqIdStr = req_id.toString()
  let numRows = 0
  const filteredPntData = useAnalysisMapStore().getFilteredPntDataByReqId(reqIdStr)
  const globalChartStore = useGlobalChartStore()

  try {
    if ((await indexedDb.getStatus(req_id)) === 'error') {
      logger.error('Request status is error, skipping', { reqId: req_id })
      return
    }

    const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id)
    const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id)
    const usfn = useFieldNameStore().getUniqueSpotIdFieldName(req_id)

    filteredPntData.isLoading = true
    filteredPntData.currentPnts = 0

    const duckDbClient = await createDuckDbClient()
    const filename = await indexedDb.getFilename(req_id)
    const func = await indexedDb.getFunc(req_id)
    let queryStr = ''

    // Construct SQL query
    const rgt = globalChartStore.getRgt()
    const cycles = globalChartStore.getCycles()
    const spots = globalChartStore.getSpots()
    let use_y_atc_filter = globalChartStore.use_y_atc_filter
    let min_y_atc = '0.0'
    let max_y_atc = '0.0'

    if (globalChartStore.selected_y_atc) {
      const y_atc_margin = globalChartStore.y_atc_margin
      min_y_atc = (globalChartStore.selected_y_atc - y_atc_margin).toFixed(3)
      max_y_atc = (globalChartStore.selected_y_atc + y_atc_margin).toFixed(3)
    } else {
      if (!func.includes('atl08') && use_y_atc_filter) {
        logger.debug('selected_y_atc is undefined, disabling y_atc filter', { reqId: req_id, func })
      }
      use_y_atc_filter = false
    }

    await duckDbClient.insertOpfsParquet(filename)

    // Get CRS information for coordinate transformation
    const geoMetadata = await getGeoMetadataFromFile(filename)
    const sourceCrs = extractCrsFromGeoMetadata(geoMetadata)
    const requiresTransformation = needsTransformation(sourceCrs)

    if (requiresTransformation && sourceCrs) {
      logger.debug('Will transform coordinates for selected layer', {
        from: sourceCrs,
        to: 'EPSG:4326'
      })
    } else if (sourceCrs) {
      logger.debug('No transformation needed for selected layer', { crs: sourceCrs })
    } else {
      logger.debug('No geo metadata CRS found for selected layer, assuming WGS 84 (EPSG:4326)')
    }

    // Check if geometry column exists and build appropriate SELECT
    const colTypes = await duckDbClient.queryColumnTypes(filename)
    const hasGeometry = colTypes.some((c) => c.name === 'geometry')

    // Get field names from fieldNameStore
    const fieldNameStore = useFieldNameStore()
    const lonField = fieldNameStore.getLonFieldName(req_id)
    const latField = fieldNameStore.getLatFieldName(req_id)
    const heightField = fieldNameStore.getHFieldName(req_id)

    let selectClause: string
    if (hasGeometry) {
      // Check if Z column exists as a separate column
      // If it does, geometry is 2D (Point) and Z is stored separately
      // If it doesn't, geometry is 3D (Point Z) and Z is in the geometry
      const hasZColumn = colTypes.some((c) => c.name === heightField)
      const geometryHasZ = !hasZColumn // Z is in geometry if there's no separate Z column

      // Build column list: all columns except geometry (and z column if it's in geometry)
      const nonGeomCols = colTypes
        .filter((c) => {
          if (c.name === 'geometry') return false
          // If Z is in geometry, exclude the separate Z column
          if (geometryHasZ && c.name === heightField) return false
          return true
        })
        .map((c) => duckDbClient.escape(c.name))

      // Add geometry extractions with field name aliases
      const geomExtractions = [
        `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(lonField)}`,
        `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(latField)}`
      ]

      // Only extract Z from geometry if it has Z, otherwise include the separate column
      if (geometryHasZ) {
        geomExtractions.push(
          `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(heightField)}`
        )
      } else {
        // Z is a separate column, already included in nonGeomCols
      }

      selectClause = [...nonGeomCols, ...geomExtractions].join(', ')
    } else {
      selectClause = '*'
    }

    queryStr = `
            SELECT ${selectClause} FROM read_parquet('${filename}')
            WHERE ${utfn} = ${rgt}
            AND ${uofn} IN (${cycles.join(', ')})
            AND ${usfn} IN (${spots.join(', ')})
        `
    if (use_y_atc_filter) {
      queryStr += `AND y_atc BETWEEN ${min_y_atc} AND ${max_y_atc}`
    }

    const rowChunks: ElevationDataItem[] = []
    const positions: Position[] = [] // Store precomputed positions

    try {
      const result = await duckDbClient.queryChunkSampled(queryStr) // No sampling for selected

      for await (const rowChunk of result.readRows()) {
        if (rowChunk.length > 0) {
          numRows += rowChunk.length
          rowChunks.push(...rowChunk)
          filteredPntData.currentPnts = numRows
          // **Precompute positions and store them with CRS transformation**
          rowChunk.forEach((d) => {
            const lon = d[lonField]
            const lat = d[latField]

            if (requiresTransformation && sourceCrs) {
              const [transformedLon, transformedLat] = transformCoordinate(lon, lat, sourceCrs)
              positions.push([transformedLon, transformedLat, 0])
            } else {
              positions.push([lon, lat, 0])
            }
          })
        }
      }
    } catch (error) {
      logger.error('Error processing chunk for selected layer', {
        reqId: req_id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    if (numRows > 0) {
      const srViewName = await indexedDb.getSrViewName(req_id)
      const projName = srViews.value[srViewName].projectionName
      const height_fieldname = useFieldNameStore().getHFieldName(req_id)
      const summary = await readOrCacheSummary(req_id)
      if (summary?.extHMean) {
        // Pass `positions` to the function so it's used efficiently
        updateDeckLayerWithObject(
          layerName,
          rowChunks,
          summary.extHMean,
          height_fieldname,
          positions,
          projName
        )
      } else {
        logger.error('Summary is undefined for selected layer', { reqId: req_id })
      }
    } else {
      logger.debug('No data items match filter criteria for selected layer', { reqId: req_id })
    }
  } catch (error) {
    logger.error('Error in duckDbReadAndUpdateSelectedLayer', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    filteredPntData.isLoading = false
    const endTime = performance.now()
    logger.debug('duckDbReadAndUpdateSelectedLayer performance', {
      reqId: req_id,
      durationMs: endTime - startTime
    })
  }
}

export async function isReqFileLoaded(reqId: number): Promise<any> {
  const startTime = performance.now() // Start time
  try {
    const fileName = await indexedDb.getFilename(reqId)
    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)
    return await duckDbClient.isParquetLoaded(fileName)
  } catch (error) {
    logger.error('Error loading parquet file', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('isReqFileLoaded performance', { reqId, durationMs: endTime - startTime })
  }
}

export async function duckDbLoadOpfsParquetFile(fileName: string): Promise<any> {
  const startTime = performance.now() // Start time
  let serverReq = ''
  try {
    //console.log('duckDbLoadOpfsParquetFile');
    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)
    try {
      const serverReqResult = await duckDbClient.getServerReqFromMetaData(fileName)
      if (serverReqResult) {
        serverReq = serverReqResult
      } else {
        logger.warn('serverReqResult is null', { fileName })
      }
    } catch (error) {
      logger.error('Error dumping parquet metadata', {
        fileName,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } catch (error) {
    logger.error('Error in duckDbLoadOpfsParquetFile', {
      fileName,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('duckDbLoadOpfsParquetFile performance', {
      fileName,
      durationMs: endTime - startTime
    })
  }
  //console.log('duckDbLoadOpfsParquetFile serverReq:', serverReq);
  return serverReq
}

export async function getGeoMetadataFromFile(fileName: string): Promise<any> {
  const startTime = performance.now()
  let geoMetadata = null
  try {
    const duckDbClient = await createDuckDbClient()
    await duckDbClient.insertOpfsParquet(fileName)
    const metadata = await duckDbClient.getAllParquetMetadata(fileName)

    if (metadata?.geo) {
      try {
        geoMetadata = JSON.parse(metadata.geo)
        logger.debug('Found geo metadata', { fileName })
      } catch (error) {
        logger.error('Error parsing geo metadata', {
          fileName,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    } else {
      logger.debug('No geo metadata found', { fileName })
    }
  } catch (error) {
    logger.error('Error in getGeoMetadataFromFile', {
      fileName,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    const endTime = performance.now()
    logger.debug('getGeoMetadataFromFile performance', {
      fileName,
      durationMs: endTime - startTime
    })
  }
  return geoMetadata
}

export interface SrScatterChartData {
  value: number[]
}

export async function getAllRgtOptionsInFile(req_id: number): Promise<SrListNumberItem[]> {
  const startTime = performance.now() // Start time
  const fileName = await indexedDb.getFilename(req_id)
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)
  const rgtOptions = [] as SrListNumberItem[]
  try {
    const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id)

    const query = `SELECT DISTINCT ${utfn} FROM '${fileName}' order by  ${utfn} ASC`
    const queryResult: QueryResult = await duckDbClient.query(query)
    //console.log('getAllRgtOptionsInFile queryResult:', queryResult);
    for await (const rowChunk of queryResult.readRows()) {
      //console.log('getAllRgtOptionsInFile rowChunk:', rowChunk);
      for (const row of rowChunk) {
        if (row) {
          rgtOptions.push({ label: row[utfn].toString(), value: row[utfn] })
        } else {
          logger.warn('Row data is null in getAllRgtOptionsInFile', { reqId: req_id })
        }
      }
    }
  } catch (error) {
    logger.error('Error in getAllRgtOptionsInFile', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getAllRgtOptionsInFile performance', {
      reqId: req_id,
      optionsCount: rgtOptions.length,
      durationMs: endTime - startTime
    })
  }
  return rgtOptions
}

export async function getPairs(req_id: number): Promise<number[]> {
  const startTime = performance.now() // Start time
  const fileName = await indexedDb.getFilename(req_id)
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)
  const pairs = [] as number[]
  try {
    const query = `SELECT DISTINCT pair FROM '${fileName}' order by pair ASC`
    const queryResult: QueryResult = await duckDbClient.query(query)
    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        if (row) {
          //console.log('getPairs row:', row);
          pairs.push(row.pair)
        } else {
          logger.warn('Row data is null in getPairs', { reqId: req_id })
        }
      }
    }
    //console.log('getPairs pairs:', pairs);
  } catch (error) {
    logger.error('Error in getPairs', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getPairs performance', {
      reqId: req_id,
      pairCount: pairs.length,
      durationMs: endTime - startTime
    })
  }
  return pairs
}

// These are IceSat-2 specific
export async function getTracks(req_id: number): Promise<number[]> {
  const startTime = performance.now() // Start time
  const fileName = await indexedDb.getFilename(req_id)
  const duckDbClient = await createDuckDbClient()
  const tracks = [] as number[]
  try {
    const query = `SELECT DISTINCT track FROM '${fileName}' order by track ASC`
    const queryResult: QueryResult = await duckDbClient.query(query)
    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        if (row) {
          //console.log('getPairs row:', row);
          tracks.push(row.track)
        } else {
          logger.warn('Row data is null in getTracks', { reqId: req_id })
        }
      }
    }
    //console.log('getPairs pairs:', pairs);
  } catch (error) {
    logger.error('Error in getTracks', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getTracks performance', {
      reqId: req_id,
      trackCount: tracks.length,
      durationMs: endTime - startTime
    })
  }
  return tracks
}

export async function getScOrient(req_id: number): Promise<number[]> {
  const startTime = performance.now() // Start time
  const fileName = await indexedDb.getFilename(req_id)
  const duckDbClient = await createDuckDbClient()
  const scOrients = [] as number[]
  try {
    const query = `SELECT DISTINCT sc_orient FROM '${fileName}' order by sc_orient ASC`
    const queryResult: QueryResult = await duckDbClient.query(query)
    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        if (row) {
          //console.log('getScOrient row:', row);
          scOrients.push(row.sc_orient)
        } else {
          logger.warn('Row data is null in getScOrient', { reqId: req_id })
        }
      }
    }
    //console.log('getScOrient scOrients:', scOrients);
  } catch (error) {
    logger.error('Error in getScOrient', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getScOrient performance', {
      reqId: req_id,
      scOrientCount: scOrients.length,
      durationMs: endTime - startTime
    })
  }
  return scOrients
}

// This uses generic field name for cycle to support GEDI
export async function getAllCycleOptionsInFile(
  req_id: number
): Promise<{ cycles: number[]; cycleOptions: SrListNumberItem[] }> {
  const startTime = performance.now() // Start time
  const time_fieldname = useFieldNameStore().getTimeFieldName(req_id)
  const fileName = await indexedDb.getFilename(req_id)
  const duckDbClient = await createDuckDbClient()

  // Make the parquet file available to DuckDB
  await duckDbClient.insertOpfsParquet(fileName)

  const cycleOptions = [] as SrListNumberItem[]
  const cycles = [] as number[]

  try {
    const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id)
    // Query: get one row per cycle with a single representative time
    // plus all distinct rgts, spots, and gts.
    const query = `
            SELECT 
                ${uofn},
                ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time  -- We only need any single time
            FROM '${fileName}'
            GROUP BY ${uofn}
            ORDER BY ${uofn} ASC;
        `

    // Run the query
    const queryResult: QueryResult = await duckDbClient.query(query)

    // Process the returned rows
    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        if (!row) {
          logger.warn('Row data is null or undefined in getAllCycleOptionsInFile', {
            reqId: req_id
          })
          continue
        }

        // Convert time to a locale-based string (e.g. MM/DD/YYYY)
        const timeStr = new Date(row.time).toLocaleDateString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })

        // Build a label for each cycle
        const value = row[uofn]
        const newLabel = `${value}: ${timeStr}`

        cycleOptions.push({
          label: newLabel,
          value: value
        })
        cycles.push(value)
      }
    }
  } catch (error) {
    logger.error('Error in getAllCycleOptionsInFile', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getAllCycleOptionsInFile performance', {
      reqId: req_id,
      cycleCount: cycles.length,
      durationMs: endTime - startTime
    })
  }

  return { cycles, cycleOptions }
}

// This uses generic field name for cycle to support GEDI
export async function getAllFilteredCycleOptionsFromFile(
  req_id: number
): Promise<SrListNumberItem[]> {
  const startTime = performance.now() // Start time

  const fileName = await indexedDb.getFilename(req_id)
  const time_fieldname = useFieldNameStore().getTimeFieldName(req_id)
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)
  const cycles: SrListNumberItem[] = []
  let whereClause = ''

  try {
    // Build the WHERE clause dynamically
    const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id)

    whereClause = createWhereClause(req_id)

    const query = `
            SELECT 
            ${uofn} AS cycle, 
            ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time 
            FROM '${fileName}'
            ${whereClause}
            GROUP BY ${uofn} 
            ORDER BY ${uofn} ASC;
        `

    const queryResult: QueryResult = await duckDbClient.query(query)

    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        if (row) {
          const timeStr = new Date(row.time).toLocaleDateString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
          const newLabel = `${row.cycle}: ${timeStr}`
          cycles.push({ label: newLabel, value: row.cycle })
        } else {
          logger.warn('Row data is null in getAllFilteredCycleOptionsFromFile', { reqId: req_id })
        }
      }
    }
  } catch (error) {
    logger.error('Error in getAllFilteredCycleOptionsFromFile', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('getAllFilteredCycleOptionsFromFile performance', {
      reqId: req_id,
      cycleCount: cycles.length,
      whereClause,
      durationMs: endTime - startTime
    })
  }
  return cycles
}

export async function updateAllFilterOptions(req_id: number): Promise<void> {
  const startTime = performance.now() // Start time
  try {
    const globalChartStore = useGlobalChartStore()
    const rgts = await getAllRgtOptionsInFile(req_id)
    globalChartStore.setRgtOptions(rgts)
    const retObj = await getAllCycleOptionsInFile(req_id)
    globalChartStore.setCycleOptions(retObj.cycleOptions)
  } catch (error) {
    logger.error('Error in updateAllFilterOptions', {
      reqId: req_id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  } finally {
    const endTime = performance.now() // End time
    logger.debug('updateAllFilterOptions performance', {
      reqId: req_id,
      durationMs: endTime - startTime
    })
  }
}
export interface FetchScatterDataOptions {
  /**
   * Extra columns to SELECT in addition to x and y columns.
   * e.g. [ 'segment_dist', 'atl03_cnf', 'atl08_class' ]
   */
  extraSelectColumns?: string[]

  /**
   * A callback to handle row transformation into `[ x, y1, y2, ..., extras ]`.
   * Must populate dataOrderNdx with the order of the columns.
   */
  transformRow?: (
    _row: any,
    _x: string,
    _y: string[],
    _minMaxLowHigh: MinMaxLowHigh,
    _dataOrderNdx: Record<string, number>,
    _orderNdx: number
  ) => [(number | string)[], number]

  /**
   * A callback for how to set store states for min/max x, or any special logic
   * required during the "min/max" query.
   */
  handleMinMaxRow?: (_reqIdStr: string, _row: any) => void

  /**
   * Optional override of the default `whereClause`.
   */
  whereClause?: string

  /**
   * Whether to normalize `x` to `[0..(max-min)]` or leave it as is.
   */
  normalizeX?: boolean

  /**
   * Optional min axis value used by base API. overlayed should use this
   */
  parentMinX?: number
}
export interface SrScatterChartDataArray {
  data: (number | string)[][]
}

export function setDataOrder(
  dataOrderNdx: Record<string, number>,
  colName: string,
  orderNdx: number
) {
  if (!dataOrderNdx[colName] && !(dataOrderNdx[colName] === 0)) {
    dataOrderNdx[colName] = orderNdx
    //console.log('setDataOrder dataOrderNdx:', dataOrderNdx, ' orderNdx:', orderNdx, ' colName:', colName);
    orderNdx = orderNdx + 1
  }
  return orderNdx
}

export async function fetchScatterData(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[],
  options: FetchScatterDataOptions
): Promise<{
  chartData: Record<string, SrScatterChartDataArray>
  minMaxLowHigh: MinMaxLowHigh
  normalizedMinMaxValues: MinMaxLowHigh
  dataOrderNdx: Record<string, number>
}> {
  const timeField = useFieldNameStore().getTimeFieldName(parseInt(reqIdStr))
  const mission = useFieldNameStore().getMissionForReqId(parseInt(reqIdStr))
  logger.debug('fetchScatterData called', { reqIdStr, fileName, x, y, options })
  // Ensure 'time' is in the y array
  if (!y.includes(timeField)) {
    y = [...y, timeField]
  }

  // Ensure 'cycle' is in the y array
  if (mission === 'ICESat-2' && !y.includes('cycle')) {
    y = [...y, 'cycle']
  }
  const {
    extraSelectColumns = [],
    transformRow,
    handleMinMaxRow,
    whereClause = useChartStore().getWhereClause(reqIdStr),
    normalizeX = options.normalizeX ?? false
  } = options

  const startTime = performance.now()
  const chartData: Record<string, SrScatterChartDataArray> = {
    [reqIdStr]: { data: [] }
  }

  const duckDbClient = await createDuckDbClient()
  const minMaxLowHigh: MinMaxLowHigh = {}
  let normalizedMinMaxValues: MinMaxLowHigh = {}
  let dataOrderNdx: Record<string, number> = {}
  let orderNdx = 0

  try {
    // Make sure the file is registered with DuckDB
    await duckDbClient.insertOpfsParquet(fileName)

    const colTypes = await duckDbClient.queryColumnTypes(fileName)
    const getColType = (colName: string) =>
      baseType(colTypes.find((c) => c.name === colName)?.type ?? 'UNKNOWN')

    // Check if geometry column exists and get geometry info
    const reqId = parseInt(reqIdStr)
    const geometryInfo = getGeometryInfo(colTypes, reqId)

    // Get field names for geometry handling
    const fieldNameStore = useFieldNameStore()
    const lon_fieldname = fieldNameStore.getLonFieldName(reqId)
    const lat_fieldname = fieldNameStore.getLatFieldName(reqId)
    const height_fieldname = fieldNameStore.getHFieldName(reqId)
    const hasGeometry = geometryInfo?.hasGeometry ?? false

    // Build WHERE clause to filter out invalid rows
    // Strategy: Only filter on X axis (required for plotting). Y columns can have NULLs (will show as gaps).
    const xType = getColType(x)
    let xColExpr: string

    // Check if X column should be extracted from geometry
    if (hasGeometry && x === lon_fieldname) {
      xColExpr = `ST_X(${duckDbClient.escape('geometry')})`
    } else if (hasGeometry && x === lat_fieldname) {
      xColExpr = `ST_Y(${duckDbClient.escape('geometry')})`
    } else if (hasGeometry && geometryInfo?.zCol && x === height_fieldname) {
      xColExpr = `ST_Z(${duckDbClient.escape('geometry')})`
    } else {
      xColExpr = duckDbClient.escape(x)
    }

    // Filter on X column validity
    let xFilterClause: string
    if (FLOAT_TYPES.has(xType)) {
      xFilterClause = `NOT isnan(${xColExpr}) AND NOT isinf(${xColExpr})`
    } else {
      xFilterClause = `${xColExpr} IS NOT NULL`
    }

    // Note: We don't filter on Y columns being NULL - they can have NULLs which will show as gaps
    // This allows plotting even when some Y columns are entirely NULL
    const yNanClause = xFilterClause

    let finalWhereClause = ''
    if (!whereClause || !whereClause.trim()) {
      finalWhereClause = `WHERE ${yNanClause}`
    } else {
      const sanitizedExistingClause = whereClause.replace(/^WHERE\s+/i, '')
      finalWhereClause = `WHERE ${sanitizedExistingClause} AND ${yNanClause}`
    }

    const allAggCols = [x, ...y, ...extraSelectColumns]

    const selectParts = buildSafeAggregateClauses(
      allAggCols,
      getColType,
      duckDbClient.escape,
      geometryInfo
    )

    const minMaxQuery = `
            SELECT
                ${selectParts.join(',\n')}
            FROM '${fileName}'
            ${finalWhereClause}
        `

    const queryResultMinMax: QueryResult = await duckDbClient.query(minMaxQuery)
    //console.log('fetchScatterData queryResultMinMax:', queryResultMinMax);
    let minXtoUse: number = options.parentMinX ?? 0
    logger.debug('fetchScatterData parentMinX', { parentMinX: options.parentMinX, minXtoUse })

    for await (const rowChunk of queryResultMinMax.readRows()) {
      //console.log('fetchScatterData rowChunk:', rowChunk);
      for (const row of rowChunk) {
        if (!row) {
          logger.warn('Row data is null in min/max query', { reqIdStr })
          continue
        }

        if (handleMinMaxRow) {
          handleMinMaxRow(reqIdStr, row)
        } else {
          // Convert to number safely, handling BigInt
          const rawMinX = safeToNumber(row[aliasKey('min', `${x}`)])
          const rawMaxX = safeToNumber(row[aliasKey('max', `${x}`)])

          if (options.parentMinX) {
            minXtoUse = options.parentMinX
          } else {
            minXtoUse = rawMinX
          }
          if (minXtoUse === rawMinX) {
            logger.debug('minXtoUse matches rawMinX', { minXtoUse, rawMinX })
          } else {
            logger.warn('minXtoUse differs from rawMinX', { minXtoUse, rawMinX })
          }
          // set min/max in the store
          useChartStore().setRawMinX(reqIdStr, rawMinX)
          useChartStore().setMinX(reqIdStr, rawMinX - minXtoUse)
          useChartStore().setMaxX(reqIdStr, rawMaxX - minXtoUse)
        }

        // Populate minMaxValues, but exclude NaN values (should be unnecessary now that we filter in SQL)
        // Convert to number safely, handling BigInt
        const minX = safeToNumber(row[aliasKey('min', `${x}`)])
        const maxX = safeToNumber(row[aliasKey('max', `${x}`)])
        const lowX = safeToNumber(row[aliasKey('low', `${x}`)])
        const highX = safeToNumber(row[aliasKey('high', `${x}`)])

        if (!isNaN(minX) && !isNaN(maxX)) {
          minMaxLowHigh[`x`] = {
            // genericize the name to x
            min: minX,
            max: maxX,
            low: lowX,
            high: highX
          }
        } else {
          logger.error('min/max x is NaN', { x, minX, maxX, aliasKey: aliasKey('min', `${x}`) })
        }

        y.forEach((yName) => {
          // Convert to number safely, handling BigInt
          const minY = safeToNumber(row[aliasKey('min', yName)])
          const maxY = safeToNumber(row[aliasKey('max', yName)])
          const lowY = safeToNumber(row[aliasKey('low', yName)])
          const highY = safeToNumber(row[aliasKey('high', yName)])

          if (!isNaN(minY) && !isNaN(maxY) && !isNaN(lowY) && !isNaN(highY)) {
            minMaxLowHigh[yName] = { min: minY, max: maxY, low: lowY, high: highY }
          } else {
            // Warn about columns with no valid data (likely all NULLs)
            logger.warn('Column has no valid data, skipping from plot', {
              yName,
              minY,
              maxY,
              lowY,
              highY
            })
          }
        })

        extraSelectColumns.forEach((colName) => {
          // Convert to number safely, handling BigInt
          const minCol = safeToNumber(row[aliasKey('min', colName)])
          const maxCol = safeToNumber(row[aliasKey('max', colName)])
          const lowCol = safeToNumber(row[aliasKey('low', colName)])
          const highCol = safeToNumber(row[aliasKey('high', colName)])

          if (!isNaN(minCol) && !isNaN(maxCol) && !isNaN(lowCol) && !isNaN(highCol)) {
            minMaxLowHigh[colName] = { min: minCol, max: maxCol, low: lowCol, high: highCol }
          }
        })
      }
    }

    /**
     * 4. Build the main query to fetch rows for x, all y columns, plus extras.
     *    Use the same finalWhereClause so NaNs in y columns are excluded.
     */
    const allColumns = [x, ...y, ...extraSelectColumns]
      .map((col) => {
        // Check if this column should be extracted from geometry
        if (hasGeometry && col === lon_fieldname) {
          return `ST_X(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`
        } else if (hasGeometry && col === lat_fieldname) {
          return `ST_Y(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`
        } else if (hasGeometry && geometryInfo?.zCol && col === height_fieldname) {
          return `ST_Z(${duckDbClient.escape('geometry')}) AS ${duckDbClient.escape(col)}`
        } else {
          return duckDbClient.escape(col)
        }
      })
      .join(', ')

    let mainQuery = `SELECT ${allColumns} \nFROM '${fileName}'\n${finalWhereClause}`
    //console.log('fetchScatterData mainQuery:', mainQuery);
    useChartStore().setQuerySql(reqIdStr, mainQuery)
    const totalRowCnt = await duckDbClient.getTotalRowCount(mainQuery)
    //console.log('fetchScatterData totalRowCnt:', totalRowCnt, ' typeof:', typeof totalRowCnt);
    //console.log('fetchScatterData max_pnts_on_plot:', useGlobalChartStore().max_pnts_on_plot, ' typeof:', typeof useGlobalChartStore().max_pnts_on_plot);

    const sample_fraction = useGlobalChartStore().max_pnts_on_plot / Number(totalRowCnt)
    const queryResultMain: QueryResult = await duckDbClient.queryChunkSampled(
      useChartStore().getQuerySql(reqIdStr),
      sample_fraction
    )
    /**
     * 5. For each row, produce an array [ xVal, yVal1, yVal2, ..., extras ]
     *    and push it into chartData[reqIdStr].data
     */
    //console.log('fetchScatterData mainQuery:', mainQuery);
    for await (const rowChunk of queryResultMain.readRows()) {
      //console.log('fetchScatterData rowChunk:', rowChunk);
      //console.log('fetchScatterData transformRow:', transformRow);
      for (const row of rowChunk) {
        if (!row) {
          logger.warn('Row data is null in main query', { reqIdStr })
          continue
        }

        let rowValues: (number | string)[] = []

        if (transformRow) {
          ;[rowValues, orderNdx] = transformRow(row, x, y, minMaxLowHigh, dataOrderNdx, orderNdx)
        } else {
          // Default transformation:
          // Convert to number or string, handling BigInt intelligently
          const xRawVal = valueToNumberOrString(row[x])
          const xVal = normalizeX && typeof xRawVal === 'number' ? xRawVal - minXtoUse : xRawVal
          rowValues = [xVal]
          orderNdx = setDataOrder(dataOrderNdx, 'x', orderNdx)

          y.forEach((yName) => {
            // Convert to number or string, handling BigInt intelligently
            const yVal = valueToNumberOrString(row[yName])
            rowValues.push(yVal)
            orderNdx = setDataOrder(dataOrderNdx, yName, orderNdx)
          })

          if (extraSelectColumns.length > 0) {
            extraSelectColumns.forEach((colName) => {
              // Convert to number or string, handling BigInt intelligently
              const colVal = valueToNumberOrString(row[colName])
              rowValues.push(colVal)
              orderNdx = setDataOrder(dataOrderNdx, colName, orderNdx)
            })
          }
        }

        chartData[reqIdStr].data.push(rowValues)
      }
    }

    /**
     * 6. If we are normalizing X, adjust min=0 and max=(max-min).
     */
    normalizedMinMaxValues = { ...minMaxLowHigh }
    if (normalizeX) {
      normalizedMinMaxValues['x'] = {
        min: 0,
        low: 0,
        max: minMaxLowHigh['x'].max - minMaxLowHigh['x'].min,
        high: minMaxLowHigh['x'].high - minMaxLowHigh['x'].min
      }
    }

    const units = x.toLowerCase() === 'latitude' ? 'Degrees' : 'Meters'

    useChartStore().setXLegend(reqIdStr, `${x} (normalized) - ${units}`)
    //console.log('fetchScatterData chartData:', chartData);
    //console.log('fetchScatterData minMaxValues:', minMaxValues);
    //console.log('fetchScatterData normalizedMinMaxValues:', normalizedMinMaxValues);
    //console.log('fetchScatterData dataOrderNdx:', dataOrderNdx);
    return { chartData, minMaxLowHigh, normalizedMinMaxValues, dataOrderNdx }
  } catch (error) {
    logger.error('Error in fetchScatterData', {
      reqIdStr,
      x,
      y,
      error: error instanceof Error ? error.message : String(error)
    })
    console.trace('fetchScatterData Error:', error)
    return { chartData: {}, minMaxLowHigh: {}, normalizedMinMaxValues: {}, dataOrderNdx: {} }
  } finally {
    const endTime = performance.now()
    logger.debug('fetchScatterData performance', { reqIdStr, durationMs: endTime - startTime })
  }
}

export async function getAllColumnMinMax(reqId: number): Promise<MinMaxLowHigh> {
  const startTime = performance.now()

  // Get all geometry and type info in one call
  const { geometryInfo, colTypes, getType, fileName, duckDbClient } =
    await getGeometryInfoWithTypes(reqId)
  const hasGeometry = geometryInfo?.hasGeometry ?? false

  // Get field names for geometry handling
  const fieldNameStore = useFieldNameStore()
  const lon_fieldname = fieldNameStore.getLonFieldName(reqId)
  const lat_fieldname = fieldNameStore.getLatFieldName(reqId)
  const height_fieldname = fieldNameStore.getHFieldName(reqId)

  // Filter down to known numeric types (exclude geometry blob itself)
  const numericCols = colTypes.filter((c) => {
    // Skip the geometry column itself
    if (c.name === 'geometry') return false

    const t = baseType(c.type)
    return (
      FLOAT_TYPES.has(t) ||
      INT_TYPES.has(t) ||
      DECIMAL_TYPES.has(t) ||
      BOOL_TYPES.has(t) || // optional: if you want min/max/percentiles for booleans
      TEMPORAL_TYPES.has(t) // optional: min/max always; percentiles via epoch casting in buildSafeAggregateClauses
    )
  })

  // If geometry exists, ensure we include lon, lat, height in the column list
  const colNames = numericCols.map((c) => c.name)
  if (hasGeometry) {
    // Add geometry-derived columns if not already present
    if (!colNames.includes(lon_fieldname)) colNames.push(lon_fieldname)
    if (!colNames.includes(lat_fieldname)) colNames.push(lat_fieldname)
    if (!colNames.includes(height_fieldname)) colNames.push(height_fieldname)
  }

  if (colNames.length === 0) {
    logger.warn('No numeric columns found', { fileName, reqId })
    return {}
  }

  // Use getType from getGeometryInfoWithTypes (already defined above)
  const selectParts = buildSafeAggregateClauses(
    colNames,
    getType,
    duckDbClient.escape,
    geometryInfo
  )
  const query = `SELECT ${selectParts.join(', ')} FROM '${fileName}'`

  const result: MinMaxLowHigh = {}

  try {
    const queryResult = await duckDbClient.query(query)
    for await (const rowChunk of queryResult.readRows()) {
      for (const row of rowChunk) {
        numericCols.forEach((c) => {
          const min = row[aliasKey('min', c.name)]
          const max = row[aliasKey('max', c.name)]
          const low = row[aliasKey('low', c.name)]
          const high = row[aliasKey('high', c.name)]

          if (min != null && max != null && low != null && high != null) {
            result[c.name] = { min, max, low, high }
          }
        })
      }
    }
  } catch (error) {
    logger.error('Error in getAllColumnMinMax', {
      reqId,
      fileName,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  const endTime = performance.now()
  logger.debug('getAllColumnMinMax performance', {
    reqId,
    columnCount: Object.keys(result).length,
    durationMs: endTime - startTime
  })
  return result
}
/**
 * For each ATL06 point, creates a single line segment centered at the point (x, y),
 * with length 40m, and a slope determined by dh_fit_dx.
 *
 * @param reqIdStr   The request id string.
 * @param fileName   Parquet file to query.
 * @param xField     Name of the x coordinate field (e.g., segment_dist or longitude).
 * @param yField     Name of the y coordinate field (e.g., h_mean).
 * @param dhFitDxField Name of the field with the segment slope (dh_fit_dx).
 * @param segmentLength The length of each segment in meters (default: 40).
 * @param whereClause Optional WHERE clause to limit rows.
 * @param minX Optional minimum x value to offset the segments.
 * @returns An array of line segments, each defined by two endpoints [[x1, y
 */
export async function getAtl06SlopeSegments(
  fileName: string,
  xField: string,
  yField: string,
  dhFitDxField: string,
  segmentLength: number = 40,
  whereClause: string = '',
  minX?: number // new param!
): Promise<number[][][]> {
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)

  let filters = []
  if (whereClause) {
    // Remove "WHERE" if present
    const clause = whereClause.replace(/^\s*WHERE\s+/i, '').trim()
    if (clause) filters.push(clause)
  }
  filters.push(`${yField} IS NOT NULL`)
  filters.push(`${dhFitDxField} IS NOT NULL`)

  const sql = `
        SELECT ${xField}, ${yField}, ${dhFitDxField}
        FROM '${fileName}'
        WHERE ${filters.join(' AND ')}
    `.replace(/\s+/g, ' ')

  const lines: number[][][] = []
  try {
    const queryResult = await duckDbClient.query(sql)
    for await (const chunk of queryResult.readRows()) {
      for (const row of chunk) {
        const rawX = Number(row[xField])
        const y = Number(row[yField])
        const slope = Number(row[dhFitDxField])
        if (!isFinite(rawX) || !isFinite(y) || !isFinite(slope)) continue

        // Normalize x for alignment with scatter plot
        const x = typeof minX === 'number' ? rawX - minX : rawX

        // Calculate line endpoints
        const denom = Math.sqrt(1 + slope * slope)
        const dx = segmentLength / 2 / denom
        const dy = slope * dx

        const x1 = x - dx
        const y1 = y - dy
        const x2 = x + dx
        const y2 = y + dy

        lines.push([
          [x1, y1],
          [x2, y2]
        ])
      }
    }
  } catch (error) {
    logger.error('Error in getAtl06SlopeSegments', {
      fileName,
      xField,
      yField,
      dhFitDxField,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
  return lines
}
