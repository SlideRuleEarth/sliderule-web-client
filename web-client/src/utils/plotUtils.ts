import { useChartStore } from '@/stores/chartStore'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { db as indexedDb } from '@/db/SlideRuleDb'
import { fetchScatterData, setDataOrder, getAtl06SlopeSegments } from '@/utils/SrDuckDbUtils'
import { type EChartsOption, type LegendComponentOption } from 'echarts'
import { createWhereClause } from './spotUtils'
import type { ECharts } from 'echarts/core'
import { duckDbReadAndUpdateSelectedLayer } from '@/utils/SrDuckDbUtils'
import { type SrRunContext } from '@/db/SlideRuleDb'
import type { SrScatterChartDataArray, FetchScatterDataOptions } from '@/utils/SrDuckDbUtils'
import type { WritableComputedRef } from 'vue'
import { reactive, computed } from 'vue'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useRequestsStore } from '@/stores/requestsStore'
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore'
import { useAtl03CnfColorMapStore } from '@/stores/atl03CnfColorMapStore'
import { useAtl08ClassColorMapStore } from '@/stores/atl08ClassColorMapStore'
import { useAtl24ClassColorMapStore } from '@/stores/atl24ClassColorMapStore'
import { formatKeyValuePair } from '@/utils/formatUtils'
import {
  SELECTED_LAYER_NAME_PREFIX,
  type MinMaxLowHigh,
  type AtlReqParams,
  type SrSvrParmsUsed
} from '@/types/SrTypes'
import { useSymbolStore } from '@/stores/symbolStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import { createDuckDbClient } from '@/utils/SrDuckDb'
import { useActiveTabStore } from '@/stores/activeTabStore'
import { useDeckStore } from '@/stores/deckStore'
import { SC_BACKWARD, SC_FORWARD } from '@/sliderule/icesat2'
import { resetFilterUsingSelectedRec } from '@/utils/SrMapUtils'
import {
  extractCrsFromGeoMetadata,
  transformCoordinate,
  needsTransformation
} from '@/utils/SrCrsTransform'
import { createLogger } from '@/utils/logger'

const logger = createLogger('PlotUtils')

export const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({})
export const yDataSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({})
export const yColorEncodeSelectedReactive = reactive<{
  [key: string]: WritableComputedRef<string>
}>({})

// Cache for coordinate transformation info per request
let cachedReqIdForTransform: number | null = null
let cachedSourceCrs: string | null = null
let cachedNeedsTransformation: boolean = false
export const solidColorSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>(
  {}
)
export const showYDataMenuReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({})
export const useGlobalMinMaxReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({})

export const selectedCyclesReactive = computed({
  get: (): number[] => {
    const value = useGlobalChartStore().getCycles()
    //console.log(`selectedCyclesReactive[${reqId}] get:`, value);
    return value
  },
  set: (values: number[]): void => {
    //console.log(`selectedCyclesReactive[${reqId}] set:`, values);
    useGlobalChartStore().setCycles(values)
  }
})

export const selectedRgtReactive = computed({
  get: (): number => {
    const value = useGlobalChartStore().getRgt()
    //console.log(`selectedRgtsReactive[${reqId}] get:`, value);
    return value ? value : 0
  },
  set: (value: number): void => {
    //console.log(`selectedRgtsReactive[${reqId}] set:`, values);
    useGlobalChartStore().setRgt(value)
  }
})

export interface SrScatterSeriesData {
  series: {
    name: string
    type: string
    data: (number | string)[][]
    dimensions?: string[]
    large?: boolean
    largeThreshold?: number
    animation?: boolean
    yAxisIndex?: number
    symbolSize?: number
    progressive?: number
    progressiveThreshold?: number
    progressiveChunkMode?: string
    itemStyle?: {
      color: string | ((_params: any) => string)
    }
    encode?: {
      x: number
      y: number
    }
    z?: number
    // the following is for line series:
    lineStyle?: {
      color: string
      width: number
    }
    symbol?: string
    polyline?: boolean
  }
  min: number | null
  max: number | null
}

export function getDefaultColorEncoding(reqId: number, parentFuncStr?: string) {
  if (reqId > 0) {
    const func = useRecTreeStore().findApiForReqId(reqId)
    if (func) {
      const fieldNameStore = useFieldNameStore()
      // Special cases that use non-height field for color encoding
      if (func === 'atl03sp') {
        return 'atl03_cnf'
      } else if (func === 'atl03x') {
        if (parentFuncStr === 'atl24x') return 'atl24_class'
        else return 'atl03_cnf'
      } else {
        // For all other APIs, use the height field (checks metadata cache first)
        return fieldNameStore.getHFieldName(reqId)
      }
    } else {
      logger.warn('No function found for reqId, returning solid color encoding', { reqId })
      return 'solid' // default color encoding
    }
  } else {
    logger.warn('Invalid reqId, returning solid color encoding', { reqId })
    return 'solid' // default color encoding
  }
}

export function initializeColorEncoding(reqId: number, parentFuncStr?: string) {
  const reqIdStr = reqId.toString()
  const chartStore = useChartStore()
  if (reqId > 0) {
    chartStore.setSelectedColorEncodeData(reqIdStr, getDefaultColorEncoding(reqId, parentFuncStr))
  }
  //console.log(`initializeColorEncoding reqId:${reqIdStr} parentFuncStr:${parentFuncStr} chartStore.getSelectedColorEncodeData:`, chartStore.getSelectedColorEncodeData(reqIdStr));
}

export function initDataBindingsToChartStore(reqIds: string[]) {
  //console.log('initDataBindingsToChartStore:', reqIds);
  const chartStore = useChartStore()
  reqIds.forEach((reqId) => {
    if (!(reqId in yDataBindingsReactive)) {
      yDataBindingsReactive[reqId] = computed({
        get: () => chartStore.getYDataOptions(reqId),
        set: (value: string[]) => chartStore.setYDataOptions(reqId, value)
      })
    }
    if (!(reqId in yDataSelectedReactive)) {
      yDataSelectedReactive[reqId] = computed({
        get: () => chartStore.getSelectedYData(reqId),
        set: (value: string) => chartStore.setSelectedYData(reqId, value)
      })
    }
    if (!(reqId in yColorEncodeSelectedReactive)) {
      yColorEncodeSelectedReactive[reqId] = computed({
        get: () => chartStore.getSelectedColorEncodeData(reqId),
        set: (value: string) => chartStore.setSelectedColorEncodeData(reqId, value)
      })
    }
    if (!(reqId in solidColorSelectedReactive)) {
      solidColorSelectedReactive[reqId] = computed({
        get: () => chartStore.getSolidSymbolColor(reqId),
        set: (value: string) => chartStore.setSolidSymbolColor(reqId, value)
      })
    }
    if (!(reqId in showYDataMenuReactive)) {
      showYDataMenuReactive[reqId] = computed({
        get: () => chartStore.getShowYDataMenu(reqId),
        set: (value: boolean) => chartStore.setShowYDataMenu(reqId, value)
      })
    }
    if (!(reqId in useGlobalMinMaxReactive)) {
      useGlobalMinMaxReactive[reqId] = computed({
        get: () => !chartStore.getUseSelectedMinMax(reqId),
        set: (value: boolean) => chartStore.setUseSelectedMinMax(reqId, !value)
      })
    }
  })
}

interface GetSeriesParams {
  reqIdStr: string
  fileName: string
  x: string
  y: string[]
  fetchOptions: FetchScatterDataOptions
  // The name of the function to fetch data:
  fetchData: (
    _reqIdStr: string,
    _fileName: string,
    _x: string,
    _y: string[],
    _fetchOptions: FetchScatterDataOptions
  ) => Promise<{
    chartData: Record<string, SrScatterChartDataArray>
    minMaxLowHigh: MinMaxLowHigh
    normalizedMinMaxValues: MinMaxLowHigh
    dataOrderNdx: Record<string, number>
  }>
  // The property name for minMax or normalizedMinMax
  minMaxProperty: 'minMaxLowHigh' | 'normalizedMinMaxValues'
  // A function or color for the series item style
  colorFunction?: (_params: any) => string
  // Additional ECharts config
  zValue: number
  // Logging prefix for console
  functionName: string
}

/**
 * A generic helper for building scatter series.
 */
async function getGenericSeries({
  reqIdStr,
  fileName,
  x,
  y,
  fetchOptions,
  fetchData,
  minMaxProperty,
  colorFunction,
  zValue,
  functionName
}: GetSeriesParams): Promise<SrScatterSeriesData[]> {
  const startTime = performance.now()
  let yItems: SrScatterSeriesData[] = []
  const plotConfig = await indexedDb.getPlotConfig()
  const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000
  const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000
  const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential'

  try {
    // Ensure lat/lon are always included for location finder, even if not displayed
    const reqId = parseInt(reqIdStr)
    const fieldNameStore = useFieldNameStore()
    const latFieldName = fieldNameStore.getLatFieldName(reqId)
    const lonFieldName = fieldNameStore.getLonFieldName(reqId)

    // Add lat/lon to extraSelectColumns if not already in y array
    const extraCols = fetchOptions.extraSelectColumns || []
    if (!y.includes(latFieldName) && !extraCols.includes(latFieldName)) {
      extraCols.push(latFieldName)
    }
    if (!y.includes(lonFieldName) && !extraCols.includes(lonFieldName)) {
      extraCols.push(lonFieldName)
    }
    fetchOptions.extraSelectColumns = extraCols

    const { chartData = {}, ...rest } = await fetchData(reqIdStr, fileName, x, y, fetchOptions)
    //console.log(`${functionName} ${reqIdStr} ${y}: chartData:`, chartData, 'fetchOptions:', fetchOptions);
    // e.g. choose minMax based on minMaxProperty
    const minMaxLowHigh = rest['minMaxLowHigh'] || {}
    const minMaxValues = rest[minMaxProperty] || {}
    //console.log(`getGenericSeries ${functionName}: minMaxValues:`, minMaxValues);
    const chartStore = useChartStore()
    chartStore.setMinMaxValues(reqIdStr, minMaxValues)
    chartStore.setMinMaxLowHigh(reqIdStr, minMaxLowHigh)
    chartStore.setDataOrderNdx(reqIdStr, rest['dataOrderNdx'] || {})
    const gradientColorMapStore = useGradientColorMapStore(reqIdStr)
    gradientColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {})
    const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr)
    atl03CnfColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {})
    const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr)
    atl08ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {})
    const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr)
    atl24ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {})
    if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
      logger.warn('Chart data or minMax is empty, skipping processing', { functionName, reqIdStr })
      return yItems
    }
    if (!colorFunction) {
      const cedk = chartStore.getSelectedColorEncodeData(reqIdStr)
      let thisColorFunction
      if (cedk === 'solid') {
        thisColorFunction = (_params: any) => chartStore.getSolidSymbolColor(reqIdStr)
      } else {
        //console.log(`getGenericSeries: chartStore.getSelectedColorEncodeData(reqIdStr):`, chartStore.getSelectedColorEncodeData(reqIdStr));
        //console.log(`getGenericSeries: chartStore.getMinMaxValues(reqIdStr):`, chartStore.getMinMaxValues(reqIdStr));
        let minValue = chartStore.getLow(reqIdStr, cedk)
        let maxValue = chartStore.getHigh(reqIdStr, cedk)
        if (!chartStore.getUseSelectedMinMax(reqIdStr)) {
          //i.e. use global min/max
          minValue = useGlobalChartStore().getLow(cedk)
          maxValue = useGlobalChartStore().getHigh(cedk)
        }
        thisColorFunction = gradientColorMapStore.createGradientColorFunction(
          cedk,
          minValue,
          maxValue
        )
      }
      colorFunction = thisColorFunction
    }
    //console.log(`${functionName}: colorFunction:`, colorFunction);
    // Get the selected Y data name
    const ySelectedName = chartStore.getSelectedYData(reqIdStr)

    // Handle race condition: if selectedYData is not yet set (empty string),
    // skip plotting and return empty array to avoid unnecessary redraw
    if (!ySelectedName) {
      logger.debug('selectedYData not yet initialized, skipping plot until data is ready', {
        functionName,
        reqIdStr
      })
      return yItems
    }

    if (y.includes(ySelectedName)) {
      const yIndex = gradientColorMapStore.getDataOrderNdx()[ySelectedName]
      const data = chartData[reqIdStr].data // get raw number[][] data
      const min = minMaxValues[ySelectedName]?.min ?? null
      const max = minMaxValues[ySelectedName]?.max ?? null
      //console.log(`${functionName}: Index of selected Y data "${ySelectedName}" in Y array is ${yIndex}. Min: ${min}, Max: ${max}`, data);

      yItems.push({
        series: {
          name: ySelectedName,
          type: 'scatter',
          data: data,
          dimensions: [...gradientColorMapStore.getDimensions()],
          encode: { x: 0, y: yIndex },
          itemStyle: { color: colorFunction },
          z: zValue,
          large: useAtlChartFilterStore().getLargeData(),
          largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
          progressive: progressiveChunkSize,
          progressiveThreshold,
          progressiveChunkMode,
          animation: false,
          yAxisIndex: 0, // only plotting one series i.e. y-axis 0
          symbolSize: useSymbolStore().getSize(reqIdStr)
        },
        min,
        max
      })

      const totalPoints = data.length
      chartStore.setNumOfPlottedPnts(reqIdStr, totalPoints)
    } else {
      logger.warn('Selected Y data not found in provided Y array', {
        functionName,
        reqIdStr,
        ySelectedName
      })
    }
  } catch (error) {
    logger.error('Error in getGenericSeries', {
      functionName,
      reqIdStr,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    const endTime = performance.now()
    logger.debug('getGenericSeries completed', {
      functionName,
      reqIdStr,
      duration: `${endTime - startTime}ms`
    })
  }

  return yItems
}

export async function getSeriesForAtl03sp(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
  const chartStore = useChartStore()
  const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr)
  const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr)
  const fetchOptions: FetchScatterDataOptions = {
    normalizeX: false,
    extraSelectColumns: ['segment_dist'],
    /**
     * handleMinMaxRow:
     * Called once for the “min/max” result row. We replicate the logic:
     *    minX = 0
     *    maxX = max_x + max_segment_dist - min_segment_dist - min_x
     * Store it in chartStore, or anywhere you like.
     */
    handleMinMaxRow: (reqId, row) => {
      chartStore.setMinX(reqId, 0)
      chartStore.setMaxX(reqId, row.max_x + row.max_segment_dist - row.min_segment_dist - row.min_x)
    },

    /**
     * transformRow:
     * Called for each record in the main query. Return an array of numbers:
     *  e.g. [ xOffset, y1, y2?, atl03_cnf, atl08_class, yapc_score ]
     *
     * xOffset = row[x] + row.segment_dist - min_segment_dist
     * (We rely on the minMaxValues passed in. By default, fetchScatterData
     * fills minMaxValues['segment_dist'] from the MIN/MAX query.)
     */
    transformRow: (row, xCol, yCols, minMaxLowHigh, dataOrderNdx, orderNdx) => {
      // figure out the offset for X
      const segMin = minMaxLowHigh['segment_dist']?.min || 0
      const xVal = row[xCol] + row.segment_dist - segMin
      orderNdx = setDataOrder(dataOrderNdx, 'x', orderNdx)

      // Start with [xVal], then push each y
      const out = [xVal]
      for (const yName of yCols) {
        // If one of the yCols is actually "segment_dist" skip it.
        if (yName !== 'segment_dist') {
          out.push(row[yName])
          orderNdx = setDataOrder(dataOrderNdx, yName, orderNdx)
        }
      }
      return [out, orderNdx]
    }
  }
  const cedk = chartStore.getSelectedColorEncodeData(reqIdStr)
  let thisColorFunction // generic will set it if is not set here
  if (cedk === 'atl03_cnf') {
    thisColorFunction = atl03CnfColorMapStore.cachedColorFunction
    // test the color function
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
    //const c1 = thisColorFunction({data:[-2]});
  } else if (cedk === 'atl08_class') {
    thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class
  }
  //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
  return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions, // pass the specialized logic above
    fetchData: fetchScatterData,
    minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
    colorFunction: thisColorFunction,
    zValue: 0,
    functionName: 'getSeriesForAtl03sp' // for the log
  })
}

export async function getSeriesForAtl03x(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[],
  parentMinX?: number
): Promise<SrScatterSeriesData[]> {
  //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
  const chartStore = useChartStore()
  const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr)
  const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr)
  const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr)
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true, parentMinX: parentMinX }
  const cedk = chartStore.getSelectedColorEncodeData(reqIdStr)
  let thisColorFunction // generic will set it if is not set here
  if (cedk === 'atl03_cnf') {
    thisColorFunction = atl03CnfColorMapStore.cachedColorFunction
    // test the color function
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
    //const c1 = thisColorFunction({data:[-2]});
  } else if (cedk === 'atl08_class') {
    thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class
  } else if (cedk === 'atl24_class') {
    thisColorFunction = atl24ClassColorMapStore.getColorUsingAtl24_class
  }
  //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
  return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions, // pass the specialized logic above
    fetchData: fetchScatterData,
    minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
    colorFunction: thisColorFunction,
    zValue: 0,
    functionName: 'getSeriesForAtl03x' // for the log
  })
}

async function getSeriesForAtl03vp(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData,
    minMaxProperty: 'minMaxLowHigh', // note the difference
    zValue: 10,
    functionName: 'getSeriesForAtl03vp'
  })
}

async function getSeriesForAtl06(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData, // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues', // note the difference
    zValue: 10, // z value for ATL06
    functionName: 'getSeriesForAtl06'
  })
}

async function getSeriesForAtl08(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData, // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues',
    zValue: 10, // z value for ATL06
    functionName: 'getSeriesForAtl08'
  })
}

async function getSeriesForAtl24(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData, // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues',
    zValue: 10, // z value for ATL24
    functionName: 'getSeriesForAtl24'
  })
}

async function getSeriesForAtl13(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData, // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues',
    zValue: 10, // z value for ATL13
    functionName: 'getSeriesForAtl13'
  })
}

async function getSeriesForGedi(
  reqIdStr: string,
  fileName: string,
  x: string,
  y: string[]
): Promise<SrScatterSeriesData[]> {
  logger.debug('getSeriesForGedi', { reqIdStr, fileName })
  const fetchOptions: FetchScatterDataOptions = { normalizeX: true }
  return await getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData, // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues', // note the difference
    zValue: 10, // z value for ATL06
    functionName: 'getSeriesForGedi'
  })
}

export function clearPlot() {
  const atlChartFilterStore = useAtlChartFilterStore()
  const plotRef = atlChartFilterStore.getPlotRef()
  if (plotRef) {
    if (plotRef.chart) {
      plotRef.chart.clear()
      logger.debug('Plot chart cleared')
    } else {
      logger.warn('Plot chart is undefined')
    }
  } else {
    logger.warn('Plot ref is undefined')
  }
}

async function ensureTransformCache(reqId: number): Promise<void> {
  if (cachedReqIdForTransform === reqId) {
    return // Already cached
  }

  try {
    const request = await indexedDb.getRequest(reqId)
    const geoMetadata = request?.geo_metadata
    cachedSourceCrs = extractCrsFromGeoMetadata(geoMetadata)
    cachedNeedsTransformation = needsTransformation(cachedSourceCrs)
    cachedReqIdForTransform = reqId
    logger.debug('Location Finder: Cached transform info', {
      reqId,
      cachedSourceCrs,
      cachedNeedsTransformation
    })
  } catch (error) {
    logger.warn('Could not load geo metadata for coordinate transformation', {
      error: error instanceof Error ? error.message : String(error)
    })
    cachedSourceCrs = null
    cachedNeedsTransformation = false
    cachedReqIdForTransform = reqId
  }
}

// Store raw coordinates temporarily before transformation
let rawLat: number | null = null
let rawLon: number | null = null

function filterDataForPos(label: any, data: any, lat: string, lon: string) {
  //console.log('filterDataForPos label:', label, 'data:', data);
  const globalChartStore = useGlobalChartStore()

  // Store raw values
  if (label === lat) {
    rawLat = data
  } else if (label === lon) {
    rawLon = data
  }

  // Only process when we have both valid coordinates
  if (
    rawLat !== null &&
    rawLon !== null &&
    typeof rawLat === 'number' &&
    typeof rawLon === 'number' &&
    isFinite(rawLat) &&
    isFinite(rawLon)
  ) {
    let finalLat = rawLat
    let finalLon = rawLon

    // Apply transformation if needed
    if (cachedNeedsTransformation && cachedSourceCrs) {
      try {
        const [transformedLon, transformedLat] = transformCoordinate(
          rawLon,
          rawLat,
          cachedSourceCrs
        )
        finalLon = transformedLon
        finalLat = transformedLat
        //console.log(`Location Finder: Transformed: (${rawLon}, ${rawLat}) -> (${transformedLon}, ${transformedLat})`);
      } catch (error) {
        logger.warn('Failed to transform coordinates for location finder', {
          error: error instanceof Error ? error.message : String(error)
        })
        // Use raw coordinates if transformation fails
      }
    }

    // Set the final coordinates
    globalChartStore.locationFinderLon = finalLon
    globalChartStore.locationFinderLat = finalLat
    //console.log(`Location Finder: Set coordinates lat=${finalLat}, lon=${finalLon}`);

    // Reset raw values for next hover
    rawLat = null
    rawLon = null
  }
  //console.log('filterDataForPos AFTER  lat:',  globalChartStore.locationFinderLat, 'lon:', globalChartStore.locationFinderLon);
}

export function formatTooltip(params: any, latFieldName: string, lonFieldName: string) {
  const paramsData = params.data
  const paramsDim = params.dimensionNames as string[]
  let ndx = 0

  const parms = paramsDim
    .map((dim) => {
      const val = paramsData[ndx++]
      filterDataForPos(dim, val, latFieldName, lonFieldName)
      return formatKeyValuePair(dim, val)
    })
    .join('<br>')
  //console.log('formatTooltip parms:', parms);
  return parms
}

async function getSeriesFor(reqIdStr: string, isOverlay = false): Promise<SrScatterSeriesData[]> {
  const chartStore = useChartStore()
  const startTime = performance.now()
  const fileName = chartStore.getFile(reqIdStr)
  const reqId = Number(reqIdStr)
  const func = useRecTreeStore().findApiForReqId(reqId)
  const x = chartStore.getXDataForChart(reqIdStr)
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)
  const existingColumns = await duckDbClient.queryForColNames(fileName)
  const all_y = chartStore.getYDataOptions(reqIdStr)
  const y = all_y.filter((col) => existingColumns.includes(col))
  // console.log('all_y:', all_y);
  // console.log('existingColumns:', existingColumns);
  // console.log('Filtered y:', y);
  // console.log('getSeriesFor Using y:',y);
  if (y.length != all_y.length) {
    const missing = all_y.filter((col) => !existingColumns.includes(col))
    const apiMismatch = !func
      ? ' (API not yet loaded - possible race condition)'
      : func
        ? ` (API: ${func})`
        : ''
    logger.warn('Y-axis length mismatch', {
      reqIdStr,
      apiMismatch,
      all_y_length: all_y.length,
      existingColumns_length: existingColumns.length,
      y_length: y.length
    })
    logger.warn('Missing Y-axis columns from file', {
      reqIdStr,
      missing_count: missing.length,
      missing
    })
    logger.warn('Available columns in file', { reqIdStr, existingColumns })
  }
  let seriesData = [] as SrScatterSeriesData[]
  let minXToUse
  if (isOverlay) {
    const rc = await indexedDb.getRunContext(reqId)
    if (rc) {
      if (rc.parentReqId) {
        minXToUse = chartStore.getRawMinX(rc.parentReqId.toString())
        logger.debug('Overlay mode: using parent minX', {
          reqIdStr,
          parentReqId: rc.parentReqId,
          minXToUse
        })
      }
    }
  }
  try {
    if (fileName) {
      if (func === 'atl03sp') {
        seriesData = await getSeriesForAtl03sp(reqIdStr, fileName, x, y)
      } else if (func === 'atl03vp') {
        seriesData = await getSeriesForAtl03vp(reqIdStr, fileName, x, y)
      } else if (func === 'atl03x') {
        seriesData = await getSeriesForAtl03x(reqIdStr, fileName, x, y, minXToUse)
      } else if (func.includes('atl06') || func.includes('atl03x-surface')) {
        seriesData = await getSeriesForAtl06(reqIdStr, fileName, x, y)
      } else if (func.includes('atl08') || func.includes('atl03x-phoreal')) {
        seriesData = await getSeriesForAtl08(reqIdStr, fileName, x, y)
      } else if (func.includes('atl24')) {
        seriesData = await getSeriesForAtl24(reqIdStr, fileName, x, y)
      } else if (func.includes('atl13')) {
        seriesData = await getSeriesForAtl13(reqIdStr, fileName, x, y) // TBD??
      } else if (func.includes('gedi')) {
        seriesData = await getSeriesForGedi(reqIdStr, fileName, x, y)
      } else {
        logger.error('Invalid func', { reqIdStr, func })
      }
      if (seriesData.length === 0) {
        logger.warn('seriesData is empty', { reqIdStr })
      }
      //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
    } else {
      logger.warn('fileName is null', { reqIdStr })
    }
  } catch (error) {
    logger.error('getSeriesFor Error', {
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    const endTime = performance.now()
    logger.debug('getSeriesFor completed', {
      reqIdStr,
      fileName,
      duration: `${endTime - startTime}ms`,
      seriesDataLength: seriesData.length
    })
    //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
  }
  return seriesData
}

export async function initChartStoreFor(reqId: number): Promise<boolean> {
  const chartStore = useChartStore()
  const reqIdStr = reqId.toString()
  let status = true
  if (reqId <= 0) {
    logger.warn('Invalid request ID', { reqId })
    return false
  }

  try {
    initializeColorEncoding(reqId)
    const request = await indexedDb.getRequest(reqId)

    if (!request) {
      logger.error('No request found for reqId', { reqIdStr, request })
      return false
    }

    const { file, description, num_bytes, cnt, parameters } = request

    if (file) {
      chartStore.setFile(reqIdStr, file)
    } else {
      logger.error('No file found for reqId', { reqIdStr, request })
      status = false
    }

    if (description) {
      chartStore.setDescription(reqIdStr, description)
    } // No warning needed for missing description.

    if (num_bytes) {
      chartStore.setSize(reqIdStr, num_bytes)
    } else {
      if (num_bytes === undefined) {
        logger.error('No num_bytes found for reqId', { reqIdStr, request })
        status = false
      }
    }

    if (cnt) {
      chartStore.setRecCnt(reqIdStr, cnt)
    } else {
      if (cnt === undefined) {
        logger.error('No cnt found for reqId', { reqIdStr, request })
        status = false
      }
    }
    if (parameters) {
      const parms = parameters as AtlReqParams
      if (parms) {
        //console.log(`initChartStoreFor ${reqIdStr} setting parameters:`, parms);
        chartStore.setParameters(reqIdStr, parms)
      } else {
        logger.warn('No parameters found for reqId', { reqIdStr, request })
        status = false
      }
    }
  } catch (error) {
    logger.error('Error processing reqId', {
      reqIdStr,
      error: error instanceof Error ? error.message : String(error)
    })
    status = false
  }
  return status
}

export async function initChartStore() {
  const startTime = performance.now()
  const recTreeStore = useRecTreeStore()
  const totalReqIds = recTreeStore.reqIdMenuItems.length
  for (const reqIdItem of recTreeStore.reqIdMenuItems) {
    const reqId = Number(reqIdItem.value)
    const status = await initChartStoreFor(reqId)
    if (!status) {
      logger.error('initChartStoreFor failed', { reqId })
    }
    await initSymbolSize(reqId)
  }
  const endTime = performance.now()
  logger.debug('initChartStore completed', { totalReqIds, duration: `${endTime - startTime}ms` })
}

export function slopeRenderItem(_params: any, api: any) {
  const x1 = api.coord([api.value(0), api.value(1)])
  const x2 = api.coord([api.value(2), api.value(3)])
  return {
    type: 'line',
    shape: {
      x1: x1[0],
      y1: x1[1],
      x2: x2[0],
      y2: x2[1]
    },
    style: api.style({
      stroke: '#60a5fa', // Light blue (matches points)
      lineWidth: 1.0
    })
  }
}

export function attachRenderItem(option: any) {
  if (option.series && Array.isArray(option.series)) {
    for (const s of option.series) {
      if (s.type === 'custom' && s.name === 'dh_fit_dx Slope') {
        s.renderItem = slopeRenderItem
      }
    }
  }
}

export async function getScatterOptions(req_id: number): Promise<any> {
  const chartStore = useChartStore()
  const globalChartStore = useGlobalChartStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const startTime = performance.now()
  const reqIdStr = req_id.toString()
  const fileName = chartStore.getFile(reqIdStr)
  const x = chartStore.getXDataForChart(reqIdStr)
  const rgt = globalChartStore.getRgt()
  const cycles = useGlobalChartStore().getCycles()
  const spots = globalChartStore.getSpots()
  const latFieldName = useFieldNameStore().getLatFieldName(req_id)
  const lonFieldName = useFieldNameStore().getLonFieldName(req_id)
  const mission = useFieldNameStore().getMissionForReqId(req_id)
  const initLegendUnselected = chartStore.getInitLegendUnselected(reqIdStr)
  // Get the CSS variable value dynamically
  const primaryButtonColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--p-button-text-primary-color')
    .trim() // Retrieve and trim the color value

  //console.log(`getScatterOptions for reqId:${reqIdStr} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
  let options = null
  try {
    let seriesData = [] as SrScatterSeriesData[]
    let slopeSeries = null
    if (mission === 'ICESat-2') {
      if (fileName) {
        if (spots.length > 0 && rgt > 0 && cycles.length > 0) {
          seriesData = await getSeriesFor(reqIdStr)
          const func = useRecTreeStore().findApiForReqId(req_id)
          // Only attempt to get slope segments for APIs that have dh_fit_dx field (ATL06-based data)
          const supportsSlopes = func && (func.includes('atl06') || func.includes('atl03x-surface'))
          if (useAtlChartFilterStore().showSlopeLines && supportsSlopes) {
            //console.log(`getSeriesFor ${reqIdStr} showSlopeLines is true, adding slope lines`);
            const minX = chartStore.getRawMinX(reqIdStr) // Use *raw* min, not normalized
            const svr_params = (await indexedDb.getSvrParams(req_id)) as SrSvrParmsUsed
            if (svr_params) {
              //console.log(`getScatterOptions ${reqIdStr} CURRENT parms:`, svr_params);
              const segmentLength = svr_params?.len
              const whereClause = chartStore.getWhereClause(reqIdStr)
              //console.log(`getScatterOptions ${reqIdStr} minX: ${minX} segmentLength: ${segmentLength} whereClause: ${whereClause}`);
              const slopeLines = await getAtl06SlopeSegments(
                fileName,
                x,
                useFieldNameStore().getHFieldName(req_id),
                'dh_fit_dx',
                segmentLength,
                whereClause,
                minX
              )
              //console.log(`getSeriesFor ${reqIdStr} slopeLines (${slopeLines.length}):`, slopeLines);
              const slopeLineItems = slopeLines.map((seg) => [
                seg[0][0],
                seg[0][1],
                seg[1][0],
                seg[1][1]
              ])
              if (slopeLineItems && slopeLineItems.length > 0) {
                slopeSeries = {
                  type: 'custom',
                  name: 'dh_fit_dx Slope',
                  coordinateSystem: 'cartesian2d',
                  data: slopeLineItems,
                  renderItem: slopeRenderItem,
                  z: 11
                }

                //console.log(`getSeriesFor ${reqIdStr} adding slopeLines series:`, slopeSeries);
              } else {
                logger.warn('showSlopeLines is true but no slope lines found', { reqIdStr })
              }
            } else {
              logger.warn('showSlopeLines is true but no svr_params found', { reqIdStr })
            }
          } else if (useAtlChartFilterStore().showSlopeLines && !supportsSlopes) {
            logger.warn('showSlopeLines is enabled but current API does not support slope data', {
              reqIdStr,
              func
            })
          }
        } else {
          logger.warn('Filter not set (spots, rgts, or cycles is empty)')
        }
      } else {
        logger.error('fileName is null', { reqIdStr })
      }
    } else if (mission === 'GEDI') {
      if (fileName) {
        seriesData = await getSeriesFor(reqIdStr)
      }
    } else {
      logger.error('Mission not supported', { reqIdStr, mission })
    }
    if (seriesData.length !== 0) {
      for (const pt of slopeSeries?.data ?? []) {
        if (Array.isArray(pt) && (!isFinite(pt[0]) || !isFinite(pt[1]))) {
          logger.warn('Bad point in slope series', { pt })
        }
      }

      const legendNames = [
        ...seriesData.map((series) => series.series.name),
        ...(slopeSeries ? [slopeSeries.name] : [])
      ]
      options = {
        title: {
          text: globalChartStore.titleOfElevationPlot,
          left: 'center'
        },
        toolbox: {
          show: true,
          orient: 'vertical',
          left: 0,
          top: 50,
          feature: {
            saveAsImage: {},
            restore: {},
            dataZoom: {},
            dataView: { readOnly: true }
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => formatTooltip(params, latFieldName, lonFieldName)
        },
        legend: {
          data: legendNames,
          selected: Object.fromEntries(legendNames.map((name) => [name, !initLegendUnselected])),
          selectedMode: !initLegendUnselected,
          left: 'left',
          itemStyle: { color: primaryButtonColor }
        },
        notMerge: true,
        lazyUpdate: true,
        xAxis: [
          {
            min: chartStore.getMinX(reqIdStr),
            max: chartStore.getMaxX(reqIdStr),
            name: chartStore.getXLegend(reqIdStr), // Add the label for the x-axis here
            nameLocation: 'middle', // Position the label in the middle of the axis
            nameTextStyle: {
              fontSize: 10,
              padding: [10, 0, 10, 0],
              margin: 10
            },
            axisLine: {
              onZero: false
            }
          }
        ],
        yAxis: [
          {
            type: 'value',
            name: seriesData.map((s) => s.series.name).join(', '),
            min: Math.min(...seriesData.map((s) => s.min).filter((m): m is number => m !== null)),
            max: Math.max(...seriesData.map((s) => s.max).filter((m): m is number => m !== null)),
            scale: true, // Add this to ensure the axis scales correctly
            axisLabel: {
              formatter: (value: number) => value.toFixed(1) // Format to one decimal place
            }
          }
        ],
        series: [
          ...seriesData.map((series) => series.series),
          ...(slopeSeries ? [slopeSeries] : [])
        ],
        dataZoom: [
          {
            type: 'slider', // This creates a slider to zoom in the X-axis
            xAxisIndex: 0,
            filterMode: 'filter',
            bottom: 1,
            start: atlChartFilterStore.xZoomStart, // Start zoom level
            end: atlChartFilterStore.xZoomEnd // End zoom level
          },
          {
            type: 'slider', // This creates a slider to zoom in the Y-axis
            yAxisIndex: seriesData.length > 1 ? [0, 1] : 0, // Adjusting for multiple y-axes if necessary
            filterMode: 'filter',
            left: '95%',
            width: 20,
            start: atlChartFilterStore.yZoomStart, // Start zoom level
            end: atlChartFilterStore.yZoomEnd, // End zoom level
            showDataShadow: false
          },
          {
            type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
            xAxisIndex: 0,
            filterMode: 'filter',
            start: atlChartFilterStore.xZoomStart, // Start zoom level
            end: atlChartFilterStore.xZoomEnd // End zoom level
          },
          {
            type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
            yAxisIndex: seriesData.length > 1 ? [0, 1] : 0,
            filterMode: 'filter',
            start: atlChartFilterStore.yZoomStart, // Start zoom level
            end: atlChartFilterStore.yZoomEnd // End zoom level
          }
        ]
      }
    } else {
      logger.warn('seriesData is empty')
    }
    //console.log('getScatterOptions options:', options);
  } catch (error) {
    logger.error('getScatterOptions Error', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
  const endTime = performance.now()
  logger.debug('getScatterOptions completed', {
    fileName,
    duration: `${endTime - startTime}ms`,
    options
  })
  return options
}

export async function getScatterOptionsFor(reqId: number) {
  const atlChartFilterStore = useAtlChartFilterStore()
  //console.log(`getScatterOptionsFor for reqId:${reqId} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
  const newScatterOptions = await getScatterOptions(reqId)
  if (!newScatterOptions) {
    atlChartFilterStore.setShowMessage(true)
    atlChartFilterStore.setIsWarning(true)
    atlChartFilterStore.setMessage(
      `reqId:${reqId} Failed to load data. Click on elevation in map to preset filters`
    )
    logger.error('Failed to load data - click on elevation in map to preset filters', { reqId })
    return
  }
  const plotRef = atlChartFilterStore.getPlotRef()

  if (Object.keys(newScatterOptions).length > 0) {
    if (plotRef?.chart) {
      attachRenderItem(newScatterOptions)
      plotRef.chart.setOption(newScatterOptions, { notMerge: true })
      logger.debug('Options applied to chart', { newScatterOptions })
      const options = plotRef.chart.getOption()
      logger.debug('Options from chart', { reqId, options })
    } else {
      logger.error('plotRef.chart is undefined', { reqId })
    }
  } else {
    logger.warn('No valid options to apply to chart')
  }
}

const initScatterPlotWith = async (reqId: number) => {
  const startTime = performance.now()
  const atlChartFilterStore = useAtlChartFilterStore()
  const chartStore = useChartStore()
  //console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

  if (reqId === undefined || reqId <= 0) {
    logger.error('reqId is empty or invalid', { reqId })
    return
  }
  await updateWhereClauseAndXData(reqId)
  const reqIdStr = reqId.toString()
  const y_options = chartStore.getYDataOptions(reqIdStr)
  const plotRef = atlChartFilterStore.getPlotRef()
  if (!plotRef?.chart) {
    logger.warn('plotRef or chart is undefined', { reqId })
    return
  }
  // Save the current zoom state of the chart before applying new options
  const chart: ECharts = plotRef.chart
  const options = chart.getOption() as EChartsOption
  //console.log(`initScatterPlotWith ${reqId} BEFORE options:`, options);
  const zoomCntrls = Array.isArray(options?.dataZoom) ? options.dataZoom : [options?.dataZoom]
  for (let zoomNdx = 0; zoomNdx < zoomCntrls.length; zoomNdx++) {
    const zoomCntrl = zoomCntrls[zoomNdx] //console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrls[zoomNdx]);
    if (zoomCntrl) {
      zoomCntrl.filterMode = 'filter'
      //console.log(`initScatterPlotWith ALL ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrl);
      if (zoomCntrl.start) {
        logger.debug('Zoom control start', { reqId, zoomNdx, start: zoomCntrl.start })
        if (zoomCntrl.xAxisIndex !== undefined) {
          atlChartFilterStore.xZoomStart = zoomCntrl.start
          //console.log(`initScatterPlotWith ${reqId} xZoomStart:`, atlChartFilterStore.xZoomStart);
        }
        if (zoomCntrl.yAxisIndex !== undefined) {
          atlChartFilterStore.yZoomStart = zoomCntrl.start
          //console.log(`initScatterPlotWith ${reqId} yZoomStart:`, atlChartFilterStore.yZoomStart);
        }
      }
      if (zoomCntrl.end) {
        logger.debug('Zoom control end', { reqId, zoomNdx, end: zoomCntrl.end })
        if (zoomCntrl.xAxisIndex !== undefined) {
          atlChartFilterStore.xZoomEnd = zoomCntrl.end
          //console.log(`initScatterPlotWith ${reqId} xZoomEnd:`, atlChartFilterStore.xZoomEnd);
        }
        if (zoomCntrl.yAxisIndex !== undefined) {
          atlChartFilterStore.yZoomEnd = zoomCntrl.end
          //console.log(`initScatterPlotWith ${reqId} yZoomEnd:`, atlChartFilterStore.yZoomEnd);
        }
      }
    }
  }
  //console.log(`initScatterPlotWith for reqId:${reqId} SAVED VALUES: xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);

  //console.log(`initScatterPlotWith ${reqId} y_options:`, y_options);
  atlChartFilterStore.setShowMessage(false)
  if (!y_options.length || y_options[0] === 'not_set') {
    logger.warn('No y options selected', { reqId })
    atlChartFilterStore.setShowMessage(true)
    atlChartFilterStore.setIsWarning(true)
    atlChartFilterStore.setMessage('No Y options selected')
  } else {
    try {
      atlChartFilterStore.setIsLoading()
      clearPlot()
      //console.log(`initScatterPlotWith for reqId:${reqId} AFTER CLEARPLOT xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
      await getScatterOptionsFor(reqId)
    } catch (error) {
      logger.error('Error fetching scatter options', {
        reqId,
        error: error instanceof Error ? error.message : String(error)
      })
      atlChartFilterStore.setShowMessage(true)
      atlChartFilterStore.setMessage('Failed to load data. Please try again later.')
    } finally {
      atlChartFilterStore.resetIsLoading()
    }
  }
  const endTime = performance.now()
  logger.debug('initScatterPlotWith completed', { reqId, duration: `${endTime - startTime}ms` })
}

// This removes the defaulted values of unused toolbox, visualMap, timeline, and calendar options from the options object
function removeUnusedOptions(options: any): any {
  if (!options) {
    return {}
  }
  delete options.visualMap
  delete options.timeline
  delete options.calendar
  //console.log('removeUnusedOptions returning options:', options);
  return options
}

async function appendSeries(reqId: number): Promise<void> {
  try {
    logger.debug('appendSeries called', { reqId })
    const reqIdStr = reqId.toString()
    const plotRef = useAtlChartFilterStore().getPlotRef()
    if (!plotRef?.chart) {
      logger.warn('plotRef or chart is undefined', { reqId: reqIdStr })
      return
    }
    const chart: ECharts = plotRef.chart

    // Retrieve existing options from the chart
    const existingOptions = chart.getOption() as EChartsOption
    const filteredOptions = removeUnusedOptions(existingOptions)
    //console.log(`appendSeries(${reqIdStr}): existingOptions:`,existingOptions,` filteredOptions:`, filteredOptions);
    // Fetch series data for the given reqIdStr
    const seriesData = await getSeriesFor(reqIdStr, true) //isOverlay=true
    if (!seriesData.length) {
      logger.warn('No series data found', { reqId: reqIdStr })
      return
    }
    //console.log(`appendSeries(${reqIdStr}): seriesData:`, seriesData);
    // Define the fields that should share a single axis
    const heightFields = [
      'height',
      'h_mean',
      'h_mean_canopy',
      'h_li',
      'ortho_h',
      'h_min_canopy',
      'h_max_canopy',
      'h_te_median'
    ]

    // Separate series into "height" group and "non-height" group
    const heightSeriesData = seriesData.filter((d) => heightFields.includes(d.series.name))
    const nonHeightSeriesData = seriesData.filter((d) => !heightFields.includes(d.series.name))
    //console.log(`appendSeries(${reqIdStr}): heightSeriesData:`, heightSeriesData);
    //console.log(`appendSeries(${reqIdStr}): nonHeightSeriesData:`, nonHeightSeriesData);
    let updatedSeries = [...(Array.isArray(filteredOptions.series) ? filteredOptions.series : [])]

    let updatedYAxis = Array.isArray(filteredOptions.yAxis) ? [...filteredOptions.yAxis] : []

    // -----------------------------
    //     HANDLE Y-AXES MERGING
    // -----------------------------
    let heightYAxisIndex: number | null = null
    let existingHeightFields: string[] = []
    let existingHeightMin = Number.POSITIVE_INFINITY
    let existingHeightMax = Number.NEGATIVE_INFINITY

    // Identify an existing height axis by checking its name against known height fields
    for (let i = 0; i < updatedYAxis.length; i++) {
      const axis = updatedYAxis[i]
      if (axis && axis.name) {
        const axisNames = axis.name.split(',').map((n: string) => n.trim())
        if (axisNames.some((n: string) => heightFields.includes(n))) {
          heightYAxisIndex = i
          existingHeightFields = axisNames
          // Extract current min/max if numeric
          if (axis.min !== undefined && typeof axis.min === 'number') {
            existingHeightMin = axis.min
          }
          if (axis.max !== undefined && typeof axis.max === 'number') {
            existingHeightMax = axis.max
          }
          break
        }
      }
    }

    // If we have height series, we need to either update or create a height axis
    if (heightSeriesData.length > 0) {
      let heightMin = Number.POSITIVE_INFINITY
      let heightMax = Number.NEGATIVE_INFINITY
      let heightNames: string[] = []

      heightSeriesData.forEach((d) => {
        if (d.min && d.min < heightMin) heightMin = d.min
        if (d.max && d.max > heightMax) heightMax = d.max
        heightNames.push(d.series.name)
      })

      if (heightYAxisIndex !== null) {
        // Update existing height axis
        const allHeightFieldsCombined = Array.from(
          new Set([...existingHeightFields, ...heightNames])
        )
        const combinedMin = Math.min(existingHeightMin, heightMin)
        const combinedMax = Math.max(existingHeightMax, heightMax)

        updatedYAxis[heightYAxisIndex] = {
          ...updatedYAxis[heightYAxisIndex],
          name: allHeightFieldsCombined.join(', '),
          min: combinedMin,
          max: combinedMax
        }
      } else {
        // No existing height axis - create a new one
        heightYAxisIndex = updatedYAxis.length
        updatedYAxis.push({
          type: 'value',
          name: heightNames.join(', '), // Concatenate height-related field names
          min: heightMin,
          max: heightMax,
          scale: true,
          axisLabel: {
            formatter: (value: number) => value.toFixed(1)
          }
        })
      }

      // Assign all height series to the identified (or newly created) height axis
      const mappedHeightSeries = heightSeriesData.map((d) => ({
        ...d.series,
        type: 'scatter',
        yAxisIndex: heightYAxisIndex as number
      }))
      updatedSeries = updatedSeries.concat(mappedHeightSeries)
    }

    // For non-height data, each one gets its own axis as a new axis
    const mappedNonHeightSeries = nonHeightSeriesData.map((d) => {
      const nonHeightAxisIndex = updatedYAxis.length
      updatedYAxis.push({
        type: 'value',
        name: d.series.name,
        min: d.min,
        max: d.max,
        scale: true,
        axisLabel: {
          formatter: (value: number) => value.toFixed(1)
        }
      })
      return {
        ...d.series,
        type: 'scatter',
        yAxisIndex: nonHeightAxisIndex
      }
    })
    updatedSeries = updatedSeries.concat(mappedNonHeightSeries)

    // -----------------------------
    //     UPDATE LEGEND
    // -----------------------------
    // 1) Grab existing legend from filteredOptions (could be array or object).
    const existingLegend = filteredOptions.legend
    let updatedLegend: LegendComponentOption[] = []

    if (Array.isArray(existingLegend) && existingLegend.length > 0) {
      // If the chart uses an array of legend configs, clone them:
      updatedLegend = existingLegend.map((legendObj) => {
        // Convert legendObj.data to an array or fallback to empty array
        const legendData = Array.isArray(legendObj.data) ? [...legendObj.data] : []

        // Gather all new series names
        const newSeriesNames = updatedSeries
          .map((s) => s.name)
          .filter((name) => !!name && !legendData.includes(name as string))

        const mergedLegendData = legendData.concat(newSeriesNames)
        return {
          ...legendObj,
          data: mergedLegendData
        }
      })
    } else if (existingLegend && !Array.isArray(existingLegend)) {
      // If it's a single legend object
      const legendData = Array.isArray(existingLegend.data) ? [...existingLegend.data] : []

      // Gather all new series names
      const newSeriesNames = updatedSeries
        .map((s) => s.name)
        .filter((name) => !!name && !legendData.includes(name as string))

      const mergedLegendData = legendData.concat(newSeriesNames)
      updatedLegend = [
        {
          ...existingLegend,
          data: mergedLegendData
        }
      ]
    } else {
      // If no legend config exists, create one
      const newSeriesNames = updatedSeries.map((s) => s.name).filter(Boolean) as string[]
      updatedLegend = [
        {
          data: newSeriesNames,
          left: 'left'
        }
      ]
    }

    attachRenderItem(filteredOptions)
    // -----------------------------
    //     APPLY UPDATED OPTIONS
    // -----------------------------
    chart.setOption(
      {
        ...filteredOptions,
        legend: updatedLegend,
        series: updatedSeries,
        yAxis: updatedYAxis
      },
      { notMerge: true }
    )
    //console.log(`appendSeries ${reqId} AFTER options:`, chart.getOption());

    //console.log( `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,chart.getOption());
  } catch (error) {
    logger.error('Error appending scatter series', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export const addOverlaysToScatterPlot = async () => {
  const startTime = performance.now()
  //console.log(`addOverlaysToScatterPlot for: ${msg}`);
  // Retrieve existing options from the chart
  const plotRef = useAtlChartFilterStore().getPlotRef()
  if (plotRef && plotRef.chart) {
    const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds()
    //console.log(`addOverlaysToScatterPlot reqIds:`, reqIds);
    for (const reqId of reqIds) {
      if (reqId > 0) {
        await updateWhereClauseAndXData(reqId)
        await appendSeries(reqId)
      } else {
        logger.error('Invalid request ID', { reqId })
      }
    }
  } else {
    logger.warn('Ignoring addOverlaysToScatterPlot with no plot to update, plotRef is undefined')
  }
  const endTime = performance.now()
  logger.debug('addOverlaysToScatterPlot completed', { duration: `${endTime - startTime}ms` })
}

export const refreshScatterPlot = async (msg: string) => {
  logger.debug('refreshScatterPlot called', { msg })
  const recTreeStore = useRecTreeStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const plotRef = atlChartFilterStore.getPlotRef()
  if (plotRef) {
    if (plotRef.chart) {
      await initScatterPlotWith(recTreeStore.selectedReqId)
      await addOverlaysToScatterPlot()
    } else {
      logger.warn(
        'Ignoring refreshScatterPlot with no chart to refresh, plotRef.chart is undefined'
      )
    }
  } else {
    logger.warn('Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined')
  }
}

export async function getPhotonOverlayRunContext(): Promise<SrRunContext> {
  const recTreeStore = useRecTreeStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const requestsStore = useRequestsStore()
  const globalChartStore = useGlobalChartStore()
  //console.log('getPhotonOverlayRunContext reqIdStr:', recTreeStore.selectedReqIdStr, ' chartStore.stateByReqId:', chartStore.stateByReqId[recTreeStore.selectedReqIdStr]);
  const runContext: SrRunContext = {
    reqId: -1, // this will be set in the worker
    parentReqId: recTreeStore.selectedReqId,
    trackFilter: {
      rgt: globalChartStore.getRgt() >= 0 ? globalChartStore.getRgt() : -1,
      cycle: globalChartStore.getCycles().length === 1 ? globalChartStore.getCycles()[0] : -1,
      track: globalChartStore.getTracks().length === 1 ? globalChartStore.getTracks()[0] : -1,
      beam: globalChartStore.getGts().length === 1 ? globalChartStore.getGts()[0] : -1
    }
  }
  if (atlChartFilterStore.getShowPhotonCloud()) {
    //console.log('Show Photon Cloud Overlay checked');
    const reqId = await indexedDb.findCachedRec(runContext)
    if (reqId && reqId > 0) {
      // Use the cached request
      runContext.reqId = reqId
      logger.debug('findCachedRec reqId found', { reqId, runContext })
      atlChartFilterStore.setSelectedOverlayedReqIds([reqId])
    } else {
      logger.warn('findCachedRec reqId not found, need to fetch', { runContext })
      requestsStore.setSvrMsg('')
    }
  }
  return runContext
}

let updatePlotTimeoutId: number | undefined
let pendingResolves: Array<() => void> = []
let inFlight = false
let pendingMessages: string[] = [] // <── collects all contributors

export async function callPlotUpdateDebounced(msg: string): Promise<void> {
  logger.debug('callPlotUpdateDebounced called', { msg })
  const atlChartFilterStore = useAtlChartFilterStore()
  atlChartFilterStore.setIsWarning(true)
  atlChartFilterStore.setMessage('Updating...')

  // Collect every reason
  pendingMessages.push(msg)

  if (updatePlotTimeoutId) {
    clearTimeout(updatePlotTimeoutId)
  }

  return await new Promise<void>((resolve) => {
    pendingResolves.push(resolve)

    updatePlotTimeoutId = window.setTimeout(async () => {
      updatePlotTimeoutId = undefined
      let errorOccurred = false
      try {
        // collapse messages into a single combined string
        const combinedMsg = pendingMessages.join(' | ')
        pendingMessages = [] // reset for next cycle

        while (inFlight) {
          await new Promise((r) => setTimeout(r, 10))
        }
        inFlight = true

        await updatePlotAndSelectedTrackMapLayer(combinedMsg)
      } catch (err) {
        errorOccurred = true
        logger.error('Plot update failed', {
          error: err instanceof Error ? err.message : String(err)
        })
      }

      inFlight = false
      if (!errorOccurred) {
        try {
          atlChartFilterStore.setIsWarning(false)
          atlChartFilterStore.setMessage('')
        } catch {
          // Intentionally empty - ignore errors when clearing UI state
        }
      }
      pendingResolves.forEach((res) => res())
      pendingResolves = []
    }, 500)
  })
}

async function updatePlotAndSelectedTrackMapLayer(msg: string): Promise<void> {
  const startTime = performance.now()
  logger.debug('updatePlotAndSelectedTrackMapLayer called', { msg })

  const globalChartStore = useGlobalChartStore()
  const recTreeStore = useRecTreeStore()
  const activeTabStore = useActiveTabStore()

  // Ensure coordinate transformation cache is initialized for this request
  await ensureTransformCache(recTreeStore.selectedReqId)

  const hasRgtOk =
    !globalChartStore.use_rgt_in_filter ||
    (globalChartStore.use_rgt_in_filter && globalChartStore.getRgt() >= 0)

  const hasCycles = globalChartStore.getCycles().length > 0
  const hasSpots = globalChartStore.getSpots().length > 0

  if (!(hasRgtOk && hasCycles && hasSpots)) {
    logger.warn('Need Rgts, Cycles, and Spots values selected', {
      rgt: globalChartStore.getRgt(),
      cycles: globalChartStore.getCycles(),
      spots: globalChartStore.getSpots()
    })
    return
  }

  const selectedApi = recTreeStore.selectedApi
  const selectedReqId = recTreeStore.selectedReqId

  let hasSelectedMapLayer = true

  if (activeTabStore.isActiveTabTimeSeries) {
    await checkAndSetFilterForTimeSeries()
    if (selectedApi === 'atl13x') hasSelectedMapLayer = false
  } else if (activeTabStore.isActiveTab3D) {
    await checkAndSetFilterFor3D()
    if (selectedApi === 'atl13x') hasSelectedMapLayer = false
  }
  // Always read this: because of the async debounce, the selectedReqId may have changed since this was called
  await duckDbReadAndUpdateSelectedLayer(selectedReqId, SELECTED_LAYER_NAME_PREFIX)
  if (!hasSelectedMapLayer) {
    useDeckStore().deleteSelectedLayer()
  }
  await refreshScatterPlot(msg)

  const endTime = performance.now()
  logger.debug('updatePlotAndSelectedTrackMapLayer completed', {
    duration: `${endTime - startTime}ms`
  })
}

export const findReqMenuLabel = (reqId: number) => {
  const recTreeStore = useRecTreeStore()
  const item = recTreeStore.reqIdMenuItems.find((i) => i.value === reqId)
  return item ? item.label : 'unknown'
}

export async function initSymbolSize(req_id: number): Promise<number> {
  const reqIdStr = req_id.toString()
  const plotConfig = await indexedDb.getPlotConfig()
  const symbolStore = useSymbolStore()
  const func = await indexedDb.getFunc(req_id) //must use db
  if (func === 'atl03sp' || func === 'atl03x' || func === 'atl03vp') {
    //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03spSymbolSize  ?? 1);
    symbolStore.setSize(reqIdStr, plotConfig?.defaultAtl03spSymbolSize ?? 1)
  } else if (func.includes('atl03vp')) {
    //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03vpSymbolSize  ?? 5);
    symbolStore.setSize(reqIdStr, plotConfig?.defaultAtl03vpSymbolSize ?? 5)
  } else {
    symbolStore.setSize(reqIdStr, plotConfig?.defaultAtl06SymbolSize ?? 3)
  }
  //console.log('initSymbolSize reqId:', req_id, 'func:', func, 'symbolSize:', chartStore.getSymbolSize(reqIdStr));
  return symbolStore.getSize(reqIdStr)
}

export function updateWhereClauseAndXData(req_id: number) {
  //console.log('updateWhereClauseAndXData req_id:', req_id);
  if (req_id <= 0) {
    logger.warn('Invalid request ID', { req_id })
    return
  }
  try {
    const reqIdStr = req_id.toString()
    //console.log('updateWhereClauseAndXData req_id:', req_id);
    const func = useRecTreeStore().findApiForReqId(req_id)
    const chartStore = useChartStore()
    chartStore.setXDataForChartUsingFunc(reqIdStr, func)

    const whereClause = createWhereClause(req_id)
    if (whereClause !== '') {
      chartStore.setWhereClause(reqIdStr, whereClause)
    } else {
      logger.error('whereClause is empty')
    }
  } catch (error) {
    logger.warn('Failed to update selected request', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
export async function checkAndSetFilterForTimeSeries() {
  //console.log('checkAndSetFilterForTimeSeries called');
  const globalChartStore = useGlobalChartStore()
  const chartStore = useChartStore()
  const reqIdStr = useRecTreeStore().selectedReqIdStr
  chartStore.setUseSelectedMinMax(reqIdStr, false)
  chartStore.setSelectedColorEncodeData(reqIdStr, 'cycle')
  if (useRecTreeStore().selectedApi === 'atl13x') {
    globalChartStore.set_use_y_atc_filter(false)
    globalChartStore.setSpots([1, 2, 3, 4, 5, 6])
    globalChartStore.setScOrients([SC_BACKWARD, SC_FORWARD])
    await globalChartStore.selectAllCycleOptions()
    globalChartStore.use_rgt_in_filter = false
    //console.log('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to:',globalChartStore.getSelectedCycleOptions(),'/', globalChartStore.getCycles());
  } else {
    globalChartStore.use_rgt_in_filter = true
    await resetFilterUsingSelectedRec()
  }
}

export async function checkAndSetFilterFor3D() {
  logger.debug('checkAndSetFilterFor3D called')
  const globalChartStore = useGlobalChartStore()
  const recTreeStore = useRecTreeStore()
  const chartStore = useChartStore()

  if (useActiveTabStore().isActiveTab3D) {
    useChartStore().setUseSelectedMinMax(useRecTreeStore().selectedReqIdStr, false)
    if (useRecTreeStore().selectedApi === 'atl13x') {
      // verticalExaggeration will be set automatically based on data in renderCachedData
      globalChartStore.set_use_y_atc_filter(false)
      globalChartStore.setSpots([1, 2, 3, 4, 5, 6])
      globalChartStore.setScOrients([SC_BACKWARD, SC_FORWARD])
      await globalChartStore.selectAllCycleOptions()
      globalChartStore.use_rgt_in_filter = false
      chartStore.setSelectedColorEncodeData(recTreeStore.selectedReqIdStr, 'cycle')
      //console.log('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to all');
    } else {
      // verticalExaggeration will be set automatically based on data in renderCachedData
      chartStore.setSelectedColorEncodeData(
        recTreeStore.selectedReqIdStr,
        getDefaultColorEncoding(recTreeStore.selectedReqId)
      )
      await resetFilterUsingSelectedRec()
      globalChartStore.use_rgt_in_filter = true
    }
  }
}
