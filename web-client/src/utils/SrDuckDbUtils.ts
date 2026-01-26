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
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import {
  useArrayColumnStore,
  type ArrayColumnConfig,
  type AggregationFunction,
  type ArrayColumnMode
} from '@/stores/arrayColumnStore'
import { buildArrayAggregateSelect, buildArrayFlattenSelect } from '@/utils/arrayAgg'
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
  getGeometryInfoWithTypes,
  buildColumnExpressions
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
 * Count invalid geometries in a parquet file (null, empty, or with non-finite coordinates).
 * Returns the count of records that will be filtered out.
 */
async function countInvalidGeometries(filename: string): Promise<number> {
  const duckDbClient = await createDuckDbClient()
  try {
    const query = `
      SELECT COUNT(*) as invalid_count
      FROM read_parquet('${filename}')
      WHERE geometry IS NULL
         OR ST_IsEmpty(geometry)
         OR NOT isfinite(ST_X(geometry))
         OR NOT isfinite(ST_Y(geometry))
    `
    const result = await duckDbClient.query(query)
    for await (const chunk of result.readRows()) {
      if (chunk.length > 0) {
        return Number((chunk[0] as { invalid_count: number }).invalid_count)
      }
    }
    return 0
  } catch (error) {
    logger.warn('Could not count invalid geometries', {
      error: error instanceof Error ? error.message : String(error)
    })
    return 0
  }
}

/** WHERE clause fragment to filter out invalid geometries */
const VALID_GEOMETRY_FILTER = `geometry IS NOT NULL AND NOT ST_IsEmpty(geometry) AND isfinite(ST_X(geometry)) AND isfinite(ST_Y(geometry))`

/**
 * Build SQL WHERE clause fragment to filter out NaN/Inf height values.
 * @param heightExpr - The SQL expression for the height column (either direct column or ST_Z extraction)
 * @returns SQL fragment like "NOT isnan(h_li) AND NOT isinf(h_li)"
 */
function buildHeightNaNFilter(heightExpr: string): string {
  return `NOT isnan(${heightExpr}) AND NOT isinf(${heightExpr})`
}

/**
 * Report invalid geometries via logger and toast notification.
 */
function reportInvalidGeometries(count: number, reqId: number, context: string): void {
  if (count > 0) {
    logger.warn(`Found invalid geometries (${context})`, {
      reqId,
      invalidCount: count,
      context
    })
    useSrToastStore().warn(
      `Invalid Geometries Filtered (${context})`,
      `${count} record(s) with invalid or missing geometry coordinates were skipped.`
    )
  }
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
  //logger.debug(`setElevationDataOptionsFromFieldNames reqId:${reqId}`, fieldNames );
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

/**
 * Check if a DuckDB type is an array/list containing numeric elements
 * Matches types like LIST<DOUBLE>, DOUBLE[], LIST<INTEGER>, etc.
 */
function isNumericArrayDuckType(type: string): boolean {
  const T = type.toUpperCase()

  // Match LIST<numeric_type> pattern
  const listMatch = T.match(/LIST\s*<\s*(.+)\s*>/)
  if (listMatch) {
    return isScalarNumericDuckType(listMatch[1].trim())
  }

  // Match numeric_type[] pattern
  const arrayMatch = T.match(/^(.+)\[\]$/)
  if (arrayMatch) {
    return isScalarNumericDuckType(arrayMatch[1].trim())
  }

  return false
}

/**
 * Extract the element type from an array type
 * e.g., "LIST<DOUBLE>" -> "DOUBLE", "INTEGER[]" -> "INTEGER"
 */
function extractArrayElementType(type: string): string | null {
  const T = type.toUpperCase()

  // Match LIST<type> pattern
  const listMatch = T.match(/LIST\s*<\s*(.+)\s*>/)
  if (listMatch) {
    return listMatch[1].trim()
  }

  // Match type[] pattern
  const arrayMatch = T.match(/^(.+)\[\]$/)
  if (arrayMatch) {
    return arrayMatch[1].trim()
  }

  return null
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

    // Detect array columns with numeric elements for optional flattening/aggregation
    const arrayColumns: ArrayColumnConfig[] = colTypes
      .filter((c) => isNumericArrayDuckType(c.type))
      .map((c) => ({
        columnName: c.name,
        columnType: c.type,
        elementType: extractArrayElementType(c.type) || 'UNKNOWN'
      }))

    // Store array columns in the array column store for UI access
    const reqIdStr = reqId.toString()
    const arrayColumnStore = useArrayColumnStore()
    arrayColumnStore.setArrayColumns(reqIdStr, arrayColumns)

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

      // Count and report invalid geometries if geometry column exists
      if (hasGeometry) {
        const invalidGeometryCount = await countInvalidGeometries(filename)
        reportInvalidGeometries(invalidGeometryCount, req_id, 'elevation data')
      }

      // Get field names from fieldNameStore
      const fieldNameStore = useFieldNameStore()
      const lonField = fieldNameStore.getLonFieldName(req_id)
      const latField = fieldNameStore.getLatFieldName(req_id)
      const heightField = fieldNameStore.getHFieldName(req_id)

      // Check if Z column exists as a separate column (needed for both SELECT and WHERE)
      const hasZColumn = colTypes.some((c) => c.name === heightField)
      const geometryHasZ = hasGeometry && !hasZColumn // Z is in geometry if there's no separate Z column

      let selectClause: string
      if (hasGeometry) {
        // Build column list: all columns except geometry (and z column if it's in geometry)
        const nonGeomCols = colTypes
          .filter((c) => {
            if (c.name === 'geometry') return false
            // If Z is in geometry, exclude the separate Z column
            if (geometryHasZ && c.name === heightField) return false
            return true
          })
          .map((c) => {
            // Extract time columns as nanoseconds (BigInt) to match CSV export format
            // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
            const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
            if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
              return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
            }
            return duckDbClient.escape(c.name)
          })

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
        // No geometry - build column list to properly handle time columns with epoch_ns
        const allCols = colTypes.map((c) => {
          // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
          const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
          if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
            return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
          }
          return duckDbClient.escape(c.name)
        })
        selectClause = allCols.join(', ')
      }

      // Build height expression for NaN filtering (from geometry Z or separate column)
      const heightExpr = geometryHasZ
        ? `ST_Z(${duckDbClient.escape('geometry')})`
        : duckDbClient.escape(heightField)

      // Build WHERE clause with geometry filter (if applicable) AND height NaN filter
      const whereConditions: string[] = []
      if (hasGeometry) {
        whereConditions.push(VALID_GEOMETRY_FILTER)
      }
      whereConditions.push(buildHeightNaNFilter(heightExpr))
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`
      const queryStr = `SELECT ${selectClause} FROM read_parquet('${filename}')${whereClause}`
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
          height_fieldname,
          positions,
          projName,
          req_id.toString()
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

    // Note: Invalid geometries are reported once during elevation data load,
    // no need to re-report here for each track selection

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
        .map((c) => {
          // Extract time columns as nanoseconds (BigInt) to match CSV export format
          // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
          const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
          if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
            return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
          }
          return duckDbClient.escape(c.name)
        })

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
      // No geometry - build column list to properly handle time columns with epoch_ns
      const allCols = colTypes.map((c) => {
        // Only apply epoch_ns to scalar timestamps, not arrays (e.g., TIMESTAMP_NS[])
        const isArrayType = c.type.includes('[]') || c.type.toUpperCase().includes('LIST')
        if ((c.name === 'time' || c.name.includes('time_ns')) && !isArrayType) {
          return `epoch_ns(${duckDbClient.escape(c.name)}) AS ${duckDbClient.escape(c.name)}`
        }
        return duckDbClient.escape(c.name)
      })
      selectClause = allCols.join(', ')
    }

    // Build query with geometry filter if applicable
    const geometryFilter = hasGeometry ? `AND ${VALID_GEOMETRY_FILTER}` : ''
    queryStr = `
            SELECT ${selectClause} FROM read_parquet('${filename}')
            WHERE ${utfn} = ${rgt}
            AND ${uofn} IN (${cycles.join(', ')})
            AND ${usfn} IN (${spots.join(', ')})
            ${geometryFilter}
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
          height_fieldname,
          positions,
          projName,
          req_id.toString()
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
/**
 * Configuration for array column processing (flattening or aggregation)
 */
export interface ArrayColumnQueryConfig {
  columnName: string
  mode: ArrayColumnMode
  aggregations?: AggregationFunction[]
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

  /**
   * Optional array column configuration for flattening or aggregation.
   * When set, the array column will be processed according to the mode:
   * - 'flatten': UNNEST the array, creating one row per element
   * - 'aggregate': Apply list functions (mean, min, max, etc.)
   */
  arrayColumnConfig?: ArrayColumnQueryConfig
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
    normalizeX = options.normalizeX ?? false,
    arrayColumnConfig
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

    // Detect derived array column names and array columns to filter from the min/max query
    // (derived columns don't exist as actual columns in the parquet file,
    // and array columns can't use APPROX_QUANTILE directly)
    let derivedArrayColumnNames: string[] = []
    let arrayColumnToFilter: string | null = null
    if (arrayColumnConfig && arrayColumnConfig.mode !== 'none') {
      const { columnName, mode, aggregations = [] } = arrayColumnConfig
      // Array columns can't use APPROX_QUANTILE directly, so filter them out in both modes
      arrayColumnToFilter = columnName
      if (mode === 'aggregate' && aggregations.length > 0) {
        derivedArrayColumnNames = aggregations.map((agg) => `${columnName}_${agg}`)
      }
    }

    // Filter derived columns AND array columns from allAggCols for the min/max query
    const allAggCols = [x, ...y, ...extraSelectColumns].filter(
      (col) => !derivedArrayColumnNames.includes(col) && col !== arrayColumnToFilter
    )

    const selectParts = buildSafeAggregateClauses(
      allAggCols,
      getColType,
      duckDbClient.escape,
      geometryInfo
    )

    // Add min/max/low/high for derived array columns using their actual expressions
    const derivedMinMaxParts: string[] = []
    if (
      arrayColumnConfig &&
      arrayColumnConfig.mode === 'aggregate' &&
      arrayColumnConfig.aggregations
    ) {
      const { columnName, aggregations } = arrayColumnConfig
      const escapedCol = duckDbClient.escape(columnName)
      // Filter out NaN and Inf values from the array before aggregating
      const filteredCol = `list_filter(${escapedCol}, x -> x IS NOT NULL AND NOT isnan(x) AND NOT isinf(x))`

      for (const agg of aggregations) {
        const derivedName = `${columnName}_${agg}`
        // Build the expression for this aggregation (using filtered array)
        let expr: string
        switch (agg) {
          case 'mean':
            expr = `list_avg(${filteredCol})`
            break
          case 'min':
            expr = `list_min(${filteredCol})`
            break
          case 'max':
            expr = `list_max(${filteredCol})`
            break
          case 'sum':
            expr = `list_sum(${filteredCol})`
            break
          case 'count':
            // Count uses original array to count all elements including NaN/Inf
            expr = `len(${escapedCol})`
            break
          case 'first':
            expr = `list_first(${filteredCol})`
            break
          case 'last':
            expr = `list_last(${filteredCol})`
            break
          case 'median':
            expr = `list_sort(${filteredCol})[CAST((len(${filteredCol}) + 1) / 2 AS INTEGER)]`
            break
          case 'stddev':
            expr = `list_aggregate(${filteredCol}, 'stddev_pop')`
            break
          case 'unique_count':
            expr = `len(list_distinct(${filteredCol}))`
            break
          default:
            continue
        }
        // Add MIN, MAX, and percentile ranges (low/high) for this derived column
        derivedMinMaxParts.push(`MIN(${expr}) AS "min_${derivedName}"`)
        derivedMinMaxParts.push(`MAX(${expr}) AS "max_${derivedName}"`)
        derivedMinMaxParts.push(
          `PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY ${expr}) AS "low_${derivedName}"`
        )
        derivedMinMaxParts.push(
          `PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${expr}) AS "high_${derivedName}"`
        )
      }
    }

    // Add min/max/low/high for flatten mode array column using list functions
    // For flatten mode, the array column will be UNNESTed in the data query,
    // but for min/max we can use list_min/list_max to avoid UNNEST in this aggregate query
    const flattenMinMaxParts: string[] = []
    if (arrayColumnToFilter) {
      const escapedCol = duckDbClient.escape(arrayColumnToFilter)
      // Filter out NaN and Inf values from the array
      const filteredCol = `list_filter(${escapedCol}, x -> x IS NOT NULL AND NOT isnan(x) AND NOT isinf(x))`

      // Use list_min/list_max to get per-row min/max, then aggregate across all rows
      flattenMinMaxParts.push(`MIN(list_min(${filteredCol})) AS "min_${arrayColumnToFilter}"`)
      flattenMinMaxParts.push(`MAX(list_max(${filteredCol})) AS "max_${arrayColumnToFilter}"`)
      // For percentiles, we need to use UNNEST - use a subquery approach
      // Use APPROX_QUANTILE on the flattened values via a lateral UNNEST
      flattenMinMaxParts.push(
        `(SELECT APPROX_QUANTILE(u.val, 0.10) FROM (SELECT UNNEST(${filteredCol}) AS val FROM '${fileName}' ${finalWhereClause}) u WHERE u.val IS NOT NULL) AS "low_${arrayColumnToFilter}"`
      )
      flattenMinMaxParts.push(
        `(SELECT APPROX_QUANTILE(u.val, 0.90) FROM (SELECT UNNEST(${filteredCol}) AS val FROM '${fileName}' ${finalWhereClause}) u WHERE u.val IS NOT NULL) AS "high_${arrayColumnToFilter}"`
      )
    }

    const allMinMaxParts = [...selectParts, ...derivedMinMaxParts, ...flattenMinMaxParts]

    const minMaxQuery = `
            SELECT
                ${allMinMaxParts.join(',\n')}
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
    // Build base column selections using shared helper
    // Filter out derived array columns and array columns in flatten mode - they'll be added via arrayColumnParts
    const columnsToExclude = [...derivedArrayColumnNames]
    if (arrayColumnToFilter) {
      columnsToExclude.push(arrayColumnToFilter)
    }
    const baseColumnParts = buildColumnExpressions([x, ...y, ...extraSelectColumns], {
      hasGeometry,
      geometryInfo,
      latFieldName: lat_fieldname,
      lonFieldName: lon_fieldname,
      heightFieldName: height_fieldname,
      escape: duckDbClient.escape,
      excludeColumns: columnsToExclude,
      getType: (col) => colTypes.find((c) => c.name === col)?.type ?? ''
    })

    // Handle array column processing - build SELECT clauses for the main query
    let arrayColumnParts: string[] = []

    if (arrayColumnConfig && arrayColumnConfig.mode !== 'none') {
      const { columnName, mode, aggregations = [] } = arrayColumnConfig

      if (mode === 'flatten') {
        // Flatten mode: UNNEST the array column
        arrayColumnParts = [buildArrayFlattenSelect(columnName)]
        // Update derivedArrayColumnNames for flatten mode (column name stays the same)
        derivedArrayColumnNames = [columnName]
        logger.debug('Array column flatten mode', { columnName })
      } else if (mode === 'aggregate' && aggregations.length > 0) {
        // Aggregate mode: Apply list functions
        arrayColumnParts = buildArrayAggregateSelect(columnName, aggregations)
        // derivedArrayColumnNames was already set above for min/max query
        logger.debug('Array column aggregate mode', {
          columnName,
          aggregations,
          derivedColumns: derivedArrayColumnNames
        })
      }

      // Store derived column names in chartStore for reference
      useChartStore().setDerivedArrayColumns(reqIdStr, derivedArrayColumnNames)
    }

    const allColumns = [...baseColumnParts, ...arrayColumnParts].join(', ')

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

          // Handle derived array columns (from flatten or aggregate mode)
          if (derivedArrayColumnNames.length > 0) {
            derivedArrayColumnNames.forEach((colName) => {
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

/**
 * Query the lat/lon bounds for points within the visible X range of the plot.
 * If no X zoom is applied (xZoomStartValue/xZoomEndValue are undefined),
 * returns bounds for all data matching the current filters.
 */
export async function getVisibleLatLonExtent(
  reqId: number
): Promise<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | null> {
  const reqIdStr = reqId.toString()
  const fileName = await indexedDb.getFilename(reqId)
  if (!fileName) {
    logger.warn('getVisibleLatLonExtent: No filename found for reqId', { reqId })
    return null
  }

  const chartStore = useChartStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const fieldNameStore = useFieldNameStore()

  // Ensure recordinfo metadata is loaded so we get correct field names from parquet
  await fieldNameStore.loadMetaForReqId(reqId)

  // Get field names for lat/lon (uses recordinfo from parquet metadata if available)
  const latField = fieldNameStore.getLatFieldName(reqId)
  const lonField = fieldNameStore.getLonFieldName(reqId)
  logger.debug('getVisibleLatLonExtent: Using field names', { reqId, latField, lonField })
  if (!latField || !lonField) {
    logger.warn('getVisibleLatLonExtent: No lat/lon field names found', {
      reqId,
      latField,
      lonField
    })
    return null
  }

  // Get the X field and current visible range
  const xField = chartStore.getXDataForChart(reqIdStr)
  let xMin = atlChartFilterStore.xZoomStartValue
  let xMax = atlChartFilterStore.xZoomEndValue

  // If value-based zoom is not set, try to get zoom state directly from ECharts
  // The store values aren't always synced when user zooms via sliders/pinch
  if ((xMin === undefined || xMax === undefined) && xField) {
    // Try to get zoom state from the chart instance
    const plotRef = atlChartFilterStore.getPlotRef()
    const chart = plotRef?.chart

    if (chart && !chart.isDisposed()) {
      const options = chart.getOption()
      const dataZoom = options?.dataZoom as
        | Array<{ start?: number; end?: number; startValue?: number; endValue?: number }>
        | undefined

      // Find the X-axis dataZoom (index 0)
      const xDataZoom = dataZoom?.[0]

      if (xDataZoom) {
        // First try to use startValue/endValue if available
        if (xDataZoom.startValue !== undefined && xDataZoom.endValue !== undefined) {
          xMin = xDataZoom.startValue
          xMax = xDataZoom.endValue
          logger.debug('getVisibleLatLonExtent: Got zoom values from chart', { xMin, xMax })
        }
        // Otherwise calculate from percentage
        else if (xDataZoom.start !== undefined && xDataZoom.end !== undefined) {
          const xZoomStartPct = xDataZoom.start
          const xZoomEndPct = xDataZoom.end

          // Only calculate if not at default (0, 100)
          if (xZoomStartPct > 0 || xZoomEndPct < 100) {
            const globalChartStore = useGlobalChartStore()
            const columnMinMax = globalChartStore.getAllColumnMinMaxValues()
            const xFieldMinMax = columnMinMax[xField]

            if (
              xFieldMinMax &&
              Number.isFinite(xFieldMinMax.min) &&
              Number.isFinite(xFieldMinMax.max)
            ) {
              const dataMin = xFieldMinMax.min
              const dataMax = xFieldMinMax.max
              const dataRange = dataMax - dataMin

              // Convert percentage (0-100) to actual value
              xMin = dataMin + (xZoomStartPct / 100) * dataRange
              xMax = dataMin + (xZoomEndPct / 100) * dataRange

              logger.debug('getVisibleLatLonExtent: Calculated zoom from percentages', {
                xMin,
                xMax
              })
            }
          }
        }
      }
    }
  }

  // The chart may use normalized X values for certain fields like x_atc
  // (x_normalized = x_raw - rawMinX). We need to convert back to raw values.
  // rawMinX is only set (and > 0) when normalization was applied.
  const rawMinX = chartStore.getRawMinX(reqIdStr) ?? 0
  const needsOffset = rawMinX > 0

  // Convert normalized zoom values back to raw values if needed
  let queryXMin = xMin
  let queryXMax = xMax
  if (needsOffset && xMin !== undefined) {
    queryXMin = xMin + rawMinX
  }
  if (needsOffset && xMax !== undefined) {
    queryXMax = xMax + rawMinX
  }

  logger.debug('getVisibleLatLonExtent: Zoom range', {
    reqId,
    xField,
    queryXMin,
    queryXMax,
    rawMinX
  })

  // Build WHERE clause - include existing filters plus X range
  let whereClause = chartStore.getWhereClause(reqIdStr) || ''

  // Add X range filter if zoomed (use converted raw values)
  if (queryXMin !== undefined && queryXMax !== undefined && xField) {
    const xFilter = `"${xField}" BETWEEN ${queryXMin} AND ${queryXMax}`
    logger.debug('getVisibleLatLonExtent: X range filter', { xFilter })
    if (whereClause) {
      const sanitizedClause = whereClause.replace(/^WHERE\s+/i, '')
      whereClause = `WHERE ${sanitizedClause} AND ${xFilter}`
    } else {
      whereClause = `WHERE ${xFilter}`
    }
  }

  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)

  // Check if this is a GeoParquet file - if so, extract lat/lon from geometry column
  const isGeoParquet = fieldNameStore.isGeoParquet(reqId)

  // Build the lat/lon expressions - use ST_X/ST_Y for GeoParquet, column names otherwise
  let latExpr: string
  let lonExpr: string
  if (isGeoParquet) {
    latExpr = 'ST_Y("geometry")'
    lonExpr = 'ST_X("geometry")'
  } else {
    latExpr = `"${latField}"`
    lonExpr = `"${lonField}"`
  }

  const query = `
    SELECT
      MIN(${latExpr}) as min_lat,
      MAX(${latExpr}) as max_lat,
      MIN(${lonExpr}) as min_lon,
      MAX(${lonExpr}) as max_lon
    FROM '${fileName}'
    ${whereClause}
  `

  logger.debug('getVisibleLatLonExtent: Executing query', { reqId, fileName })

  try {
    const result = await duckDbClient.query(query)
    let row: any = null

    for await (const chunk of result.readRows()) {
      if (chunk.length > 0) {
        row = chunk[0]
        break
      }
    }

    if (!row) {
      logger.warn('getVisibleLatLonExtent: No results from query', { reqId })
      return null
    }

    logger.debug('getVisibleLatLonExtent: Query result', { reqId, row })

    // Check for null values first - this happens when no rows match the WHERE clause
    // MIN/MAX return NULL when there are no matching rows
    if (
      row.min_lat === null ||
      row.max_lat === null ||
      row.min_lon === null ||
      row.max_lon === null
    ) {
      logger.warn(
        'getVisibleLatLonExtent: Query returned null values (no matching rows in zoom range)',
        {
          reqId,
          min_lat: row.min_lat,
          max_lat: row.max_lat,
          min_lon: row.min_lon,
          max_lon: row.max_lon
        }
      )
      return null
    }

    const minLat = Number(row.min_lat)
    const maxLat = Number(row.max_lat)
    const minLon = Number(row.min_lon)
    const maxLon = Number(row.max_lon)

    if (
      !Number.isFinite(minLat) ||
      !Number.isFinite(maxLat) ||
      !Number.isFinite(minLon) ||
      !Number.isFinite(maxLon)
    ) {
      logger.warn('getVisibleLatLonExtent: Invalid extent values after conversion', {
        reqId,
        minLat,
        maxLat,
        minLon,
        maxLon
      })
      return null
    }

    logger.debug('getVisibleLatLonExtent result', { reqId, minLat, maxLat, minLon, maxLon })
    return { minLat, maxLat, minLon, maxLon }
  } catch (error) {
    logger.error('getVisibleLatLonExtent: Query failed', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}
