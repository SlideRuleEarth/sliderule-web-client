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
import { formatKeyValuePair, formatTime } from '@/utils/formatUtils'
import {
  SELECTED_LAYER_NAME_PREFIX,
  type MinMaxLowHigh,
  type AtlReqParams,
  type SrSvrParmsUsed
} from '@/types/SrTypes'
import { useSymbolStore } from '@/stores/symbolStore'
import { usePlotConfigStore } from '@/stores/plotConfigStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import { useArrayColumnStore } from '@/stores/arrayColumnStore'
import { useSrcIdTblStore } from '@/stores/srcIdTblStore'
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
import { getGeometryInfo, buildColumnExpressions } from '@/utils/duckAgg'

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
    //logger.debug(`selectedCyclesReactive[${reqId}] get:`, value);
    return value
  },
  set: (values: number[]): void => {
    //logger.debug(`selectedCyclesReactive[${reqId}] set:`, values);
    useGlobalChartStore().setCycles(values)
  }
})

export const selectedRgtReactive = computed({
  get: (): number => {
    const value = useGlobalChartStore().getRgt()
    //logger.debug(`selectedRgtsReactive[${reqId}] get:`, value);
    return value ? value : 0
  },
  set: (value: number): void => {
    //logger.debug(`selectedRgtsReactive[${reqId}] set:`, values);
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
    emphasis?: {
      scale?: boolean
      itemStyle?: {
        borderColor?: string
        borderWidth?: number
        shadowBlur?: number
        shadowColor?: string
      }
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
  //logger.debug(`initializeColorEncoding reqId:${reqIdStr} parentFuncStr:${parentFuncStr} chartStore.getSelectedColorEncodeData:`, chartStore.getSelectedColorEncodeData(reqIdStr));
}

export function initDataBindingsToChartStore(reqIds: string[]) {
  //logger.debug('initDataBindingsToChartStore:', reqIds);
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
  const plotConfigStore = usePlotConfigStore()
  const progressiveChunkSize = plotConfigStore.progressiveChunkSize
  const progressiveThreshold = plotConfigStore.progressiveChunkThreshold
  const progressiveChunkMode = plotConfigStore.progressiveChunkMode

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

    // Get array column configuration from store if available
    const arrayColumnStore = useArrayColumnStore()
    const arrayConfig = arrayColumnStore.getActiveConfig(reqIdStr)
    if (arrayConfig) {
      fetchOptions.arrayColumnConfig = {
        columnName: arrayConfig.columnName,
        mode: arrayConfig.mode,
        aggregations: arrayConfig.aggregations
      }
      logger.debug('Array column config applied', { reqIdStr, arrayConfig })
    }

    const { chartData = {}, ...rest } = await fetchData(reqIdStr, fileName, x, y, fetchOptions)
    //logger.debug(`${functionName} ${reqIdStr} ${y}: chartData:`, chartData, 'fetchOptions:', fetchOptions);
    // e.g. choose minMax based on minMaxProperty
    const minMaxLowHigh = rest['minMaxLowHigh'] || {}
    const minMaxValues = rest[minMaxProperty] || {}
    //logger.debug(`getGenericSeries ${functionName}: minMaxValues:`, minMaxValues);
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
        //logger.debug(`getGenericSeries: chartStore.getSelectedColorEncodeData(reqIdStr):`, chartStore.getSelectedColorEncodeData(reqIdStr));
        //logger.debug(`getGenericSeries: chartStore.getMinMaxValues(reqIdStr):`, chartStore.getMinMaxValues(reqIdStr));
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
    //logger.debug(`${functionName}: colorFunction:`, colorFunction);
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
      //logger.debug(`${functionName}: Index of selected Y data "${ySelectedName}" in Y array is ${yIndex}. Min: ${min}, Max: ${max}`, data);

      yItems.push({
        series: {
          name: ySelectedName,
          type: 'scatter',
          data: data,
          dimensions: [...gradientColorMapStore.getDimensions()],
          encode: { x: 0, y: yIndex },
          itemStyle: { color: colorFunction },
          emphasis: {
            scale: true,
            itemStyle: {
              borderColor: '#ff0000',
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: 'rgba(255, 0, 0, 0.5)'
            }
          },
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
  //logger.debug('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
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
    //logger.debug(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
    //const c1 = thisColorFunction({data:[-2]});
  } else if (cedk === 'atl08_class') {
    thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class
  }
  //logger.debug(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
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
  //logger.debug('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
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
    //logger.debug(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
    //const c1 = thisColorFunction({data:[-2]});
  } else if (cedk === 'atl08_class') {
    thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class
  } else if (cedk === 'atl24_class') {
    thisColorFunction = atl24ClassColorMapStore.getColorUsingAtl24_class
  }
  //logger.debug(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
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
      logger.debug('Plot chart is undefined, skipping clear')
    }
  } else {
    // Plot component hasn't mounted yet - this is normal during initialization
    logger.debug('Plot ref not yet initialized, skipping clear')
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
  //logger.debug('filterDataForPos label:', label, 'data:', data);
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
        //logger.debug(`Location Finder: Transformed: (${rawLon}, ${rawLat}) -> (${transformedLon}, ${transformedLat})`);
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
    //logger.debug(`Location Finder: Set coordinates lat=${finalLat}, lon=${finalLon}`);

    // Reset raw values for next hover
    rawLat = null
    rawLon = null
  }
  //logger.debug('filterDataForPos AFTER  lat:',  globalChartStore.locationFinderLat, 'lon:', globalChartStore.locationFinderLon);
}

// Callback for storing tooltip content
let tooltipContentCallback: ((_text: string) => void) | null = null

export function setTooltipContentCallback(callback: ((_text: string) => void) | null) {
  tooltipContentCallback = callback
}

// Update location finder from chart mouseover event (works even when tooltip is disabled)
export function updateLocationFinderFromEvent(
  params: any,
  latFieldName: string,
  lonFieldName: string
) {
  if (!params?.data || !params?.dimensionNames) return

  const paramsData = params.data
  const paramsDim = params.dimensionNames as string[]

  paramsDim.forEach((dim, ndx) => {
    const val = paramsData[ndx]
    filterDataForPos(dim, val, latFieldName, lonFieldName)
  })
}

export function formatTooltip(
  params: any,
  latFieldName: string,
  lonFieldName: string,
  reqIdStr: string
) {
  const paramsData = params.data
  const paramsDim = params.dimensionNames as string[]
  const reqId = Number(reqIdStr)

  // Build HTML with time_ns_fmt added after any time_ns fields
  const htmlParts: string[] = []
  for (let i = 0; i < paramsDim.length; i++) {
    const dim = paramsDim[i]
    const val = paramsData[i]
    filterDataForPos(dim, val, latFieldName, lonFieldName)
    htmlParts.push(formatKeyValuePair(dim, val, reqId))
    // Add formatted time field after time_ns fields
    // Check for number, bigint, or numeric string (echarts may convert bigint to string)
    if (dim.includes('time_ns') && val != null) {
      const numVal = typeof val === 'bigint' ? val : typeof val === 'number' ? val : BigInt(val)
      const fmtKey = dim.replace('time_ns', 'time_ns_fmt')
      htmlParts.push(formatKeyValuePair(fmtKey, formatTime(numVal), reqId))
    }
  }
  const parms = htmlParts.join('<br>')

  // Add record ID as the first line
  const htmlWithRecordId = `<strong>Record ID</strong>: <em>${reqIdStr}</em><br>${parms}`

  // Convert HTML to plain text for text export
  const srcIdStore = useSrcIdTblStore()
  const sourceTable = srcIdStore.getSourceTableForReqId(reqId)
  const textParts: string[] = []
  for (let i = 0; i < paramsDim.length; i++) {
    const dim = paramsDim[i]
    const val = paramsData[i]
    const plainKey = dim === 'srcid' ? 'granule' : dim
    let plainValue: string
    if (dim === 'srcid') {
      if (sourceTable.length - 1 >= val) {
        plainValue = `${val}: ${sourceTable[val]}`
      } else {
        plainValue = `${val}: <unknown source>`
      }
    } else if (dim.includes('time_ns') && val != null) {
      // Format time_ns as integer string (no decimal point, matching CSV format)
      plainValue = typeof val === 'bigint' ? val.toString() : BigInt(val).toString()
    } else {
      plainValue = String(val)
    }
    textParts.push(`${plainKey}: ${plainValue}`)
    // Add formatted time field after time_ns fields for text export
    if (dim.includes('time_ns') && val != null) {
      const numVal = typeof val === 'bigint' ? val : typeof val === 'number' ? val : BigInt(val)
      const fmtKey = dim.replace('time_ns', 'time_ns_fmt')
      textParts.push(`${fmtKey}: ${formatTime(numVal)}`)
    }
  }
  const textContent = textParts.join('\n')

  // Add record ID as the first line for text export
  const textWithRecordId = `Record ID: ${reqIdStr}\n${textContent}`

  // Call the callback with text version
  if (tooltipContentCallback) {
    tooltipContentCallback(textWithRecordId)
  }

  //logger.debug('formatTooltip parms:', parms);
  return htmlWithRecordId
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
  let existingColumns = await duckDbClient.queryForColNames(fileName)

  // Check if file has geometry column and add geometry-derived field names
  // These fields (height, longitude, latitude) are extracted at query time using ST_Z, ST_X, ST_Y
  // but don't exist as actual columns in the parquet file
  const colTypes = await duckDbClient.queryColumnTypes(fileName)
  const geometryInfo = getGeometryInfo(colTypes, reqId)
  if (geometryInfo?.hasGeometry) {
    // Always add longitude and latitude since they're always extracted from geometry
    if (geometryInfo.xCol && !existingColumns.includes(geometryInfo.xCol)) {
      existingColumns.push(geometryInfo.xCol)
    }
    if (geometryInfo.yCol && !existingColumns.includes(geometryInfo.yCol)) {
      existingColumns.push(geometryInfo.yCol)
    }
    // Only add height if Z is stored in geometry (not as separate column)
    if (geometryInfo.zCol && !existingColumns.includes(geometryInfo.zCol)) {
      existingColumns.push(geometryInfo.zCol)
    }
  }

  // Add derived array columns to existingColumns
  // These columns are computed at query time (e.g., tx_waveform_mean from list_avg)
  // but don't exist as actual columns in the parquet file
  const derivedArrayColumns = chartStore.getDerivedArrayColumns(reqIdStr)
  for (const derivedCol of derivedArrayColumns) {
    if (!existingColumns.includes(derivedCol)) {
      existingColumns.push(derivedCol)
    }
  }

  const all_y = chartStore.getYDataOptions(reqIdStr)
  const y = all_y.filter((col) => existingColumns.includes(col))
  // logger.debug('all_y:', all_y);
  // logger.debug('existingColumns:', existingColumns);
  // logger.debug('Filtered y:', y);
  // logger.debug('getSeriesFor Using y:',y);
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
      //logger.debug(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
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
    //logger.debug(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
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
        //logger.debug(`initChartStoreFor ${reqIdStr} setting parameters:`, parms);
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

  //logger.debug(`getScatterOptions for reqId:${reqIdStr} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
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
            //logger.debug(`getSeriesFor ${reqIdStr} showSlopeLines is true, adding slope lines`);
            const minX = chartStore.getRawMinX(reqIdStr) // Use *raw* min, not normalized
            const svr_params = (await indexedDb.getSvrParams(req_id)) as SrSvrParmsUsed
            if (svr_params) {
              //logger.debug(`getScatterOptions ${reqIdStr} CURRENT parms:`, svr_params);
              const segmentLength = svr_params?.len
              const whereClause = chartStore.getWhereClause(reqIdStr)
              //logger.debug(`getScatterOptions ${reqIdStr} minX: ${minX} segmentLength: ${segmentLength} whereClause: ${whereClause}`);
              const slopeLines = await getAtl06SlopeSegments(
                fileName,
                x,
                useFieldNameStore().getHFieldName(req_id),
                'dh_fit_dx',
                segmentLength,
                whereClause,
                minX
              )
              //logger.debug(`getSeriesFor ${reqIdStr} slopeLines (${slopeLines.length}):`, slopeLines);
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

                //logger.debug(`getSeriesFor ${reqIdStr} adding slopeLines series:`, slopeSeries);
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
      logger.debug('getScatterOptions: Creating options with zoom values', {
        reqIdStr,
        yZoomStart: atlChartFilterStore.yZoomStart,
        yZoomEnd: atlChartFilterStore.yZoomEnd,
        yZoomStartValue: atlChartFilterStore.yZoomStartValue,
        yZoomEndValue: atlChartFilterStore.yZoomEndValue,
        willUseValueMode:
          atlChartFilterStore.yZoomStartValue !== undefined &&
          atlChartFilterStore.yZoomEndValue !== undefined,
        yAxisMin: Math.min(...seriesData.map((s) => s.min).filter((m): m is number => m !== null)),
        yAxisMax: Math.max(...seriesData.map((s) => s.max).filter((m): m is number => m !== null))
      })
      options = {
        // Disable hover layer to prevent progressive rendering conflicts when hovering over toolbox
        // Without this, hovering over dataZoom controls causes partial chart disappearance with large datasets
        hoverLayerThreshold: 0,
        title: {
          text: globalChartStore.titleOfElevationPlot,
          left: 'center'
        },
        toolbox: {
          show: false // Temporarily hidden - causes rendering issues with large datasets
        },
        tooltip: {
          show: globalChartStore.showPlotTooltip,
          trigger: 'item',
          formatter: (params: any) => formatTooltip(params, latFieldName, lonFieldName, reqIdStr),
          confine: true,
          position: function (
            point: number[],
            _params: any,
            _dom: HTMLElement,
            _rect: any,
            size: any
          ) {
            // point is the mouse position [x, y]
            // size contains viewSize and contentSize: {viewSize: [width, height], contentSize: [width, height]}
            const tooltipWidth = size.contentSize[0]
            const tooltipHeight = size.contentSize[1]
            const chartWidth = size.viewSize[0]
            const chartHeight = size.viewSize[1]

            let x = point[0]
            let y = point[1]

            // Offset tooltip from cursor
            const offset = 15

            // Default position: right and below cursor
            x = point[0] + offset
            y = point[1] + offset

            // If tooltip would overflow right edge, position it to the left of cursor
            if (x + tooltipWidth > chartWidth) {
              x = point[0] - tooltipWidth - offset
            }

            // If tooltip would overflow bottom edge, position it above cursor
            if (y + tooltipHeight > chartHeight) {
              y = point[1] - tooltipHeight - offset
            }

            // Ensure tooltip doesn't go off left edge
            if (x < 0) {
              x = offset
            }

            // Ensure tooltip doesn't go off top edge
            if (y < 0) {
              y = offset
            }

            return [x, y]
          }
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
            // Use actual data values if available, otherwise fall back to percentages
            ...(atlChartFilterStore.xZoomStartValue !== undefined &&
            atlChartFilterStore.xZoomEndValue !== undefined
              ? {
                  startValue: atlChartFilterStore.xZoomStartValue,
                  endValue: atlChartFilterStore.xZoomEndValue
                }
              : { start: atlChartFilterStore.xZoomStart, end: atlChartFilterStore.xZoomEnd })
          },
          {
            type: 'slider', // This creates a slider to zoom in the Y-axis
            yAxisIndex: seriesData.length > 1 ? [0, 1] : 0, // Adjusting for multiple y-axes if necessary
            filterMode: 'filter',
            left: '95%',
            width: 20,
            showDataShadow: false,
            // Use actual data values if available, otherwise fall back to percentages
            ...(atlChartFilterStore.yZoomStartValue !== undefined &&
            atlChartFilterStore.yZoomEndValue !== undefined
              ? {
                  startValue: atlChartFilterStore.yZoomStartValue,
                  endValue: atlChartFilterStore.yZoomEndValue
                }
              : { start: atlChartFilterStore.yZoomStart, end: atlChartFilterStore.yZoomEnd })
          },
          {
            type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
            xAxisIndex: 0,
            filterMode: 'filter',
            // Use actual data values if available, otherwise fall back to percentages
            ...(atlChartFilterStore.xZoomStartValue !== undefined &&
            atlChartFilterStore.xZoomEndValue !== undefined
              ? {
                  startValue: atlChartFilterStore.xZoomStartValue,
                  endValue: atlChartFilterStore.xZoomEndValue
                }
              : { start: atlChartFilterStore.xZoomStart, end: atlChartFilterStore.xZoomEnd })
          },
          {
            type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
            yAxisIndex: seriesData.length > 1 ? [0, 1] : 0,
            filterMode: 'filter',
            // Use actual data values if available, otherwise fall back to percentages
            ...(atlChartFilterStore.yZoomStartValue !== undefined &&
            atlChartFilterStore.yZoomEndValue !== undefined
              ? {
                  startValue: atlChartFilterStore.yZoomStartValue,
                  endValue: atlChartFilterStore.yZoomEndValue
                }
              : { start: atlChartFilterStore.yZoomStart, end: atlChartFilterStore.yZoomEnd })
          }
        ]
      }
    } else {
      logger.warn('seriesData is empty')
    }
    //logger.debug('getScatterOptions options:', options);
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
  //logger.debug(`getScatterOptionsFor for reqId:${reqId} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
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
  //logger.debug(`initScatterPlotWith ${reqId} startTime:`, startTime);

  if (reqId === undefined || reqId <= 0) {
    logger.error('reqId is empty or invalid', { reqId })
    return
  }

  // Check if this is a new track (reqId changed) - if so, reset zoom
  if (atlChartFilterStore.lastReqId !== reqId) {
    logger.debug('New track detected - resetting zoom', {
      oldReqId: atlChartFilterStore.lastReqId,
      newReqId: reqId
    })
    atlChartFilterStore.resetZoom()
    atlChartFilterStore.lastReqId = reqId
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
  //logger.debug(`initScatterPlotWith ${reqId} BEFORE options:`, options);
  const zoomCntrls = Array.isArray(options?.dataZoom) ? options.dataZoom : [options?.dataZoom]
  logger.debug('initScatterPlotWith: Capturing zoom BEFORE rebuild', {
    reqId,
    beforeYStart: atlChartFilterStore.yZoomStart,
    beforeYEnd: atlChartFilterStore.yZoomEnd,
    beforeYStartValue: atlChartFilterStore.yZoomStartValue,
    beforeYEndValue: atlChartFilterStore.yZoomEndValue,
    yAxisFromChart: Array.isArray(options?.yAxis)
      ? options.yAxis.map((a: any) => ({ name: a?.name, min: a?.min, max: a?.max }))
      : { name: options?.yAxis?.name, min: options?.yAxis?.min, max: options?.yAxis?.max }
  })
  for (let zoomNdx = 0; zoomNdx < zoomCntrls.length; zoomNdx++) {
    const zoomCntrl = zoomCntrls[zoomNdx] //logger.debug(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrls[zoomNdx]);
    if (zoomCntrl) {
      zoomCntrl.filterMode = 'filter'
      //logger.debug(`initScatterPlotWith ALL ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrl);
      if (zoomCntrl.start !== undefined) {
        logger.debug('Zoom control start', {
          reqId,
          zoomNdx,
          start: zoomCntrl.start,
          startValue: zoomCntrl.startValue
        })
        if (zoomCntrl.xAxisIndex !== undefined) {
          // Only update percentage if we don't have value-based zoom active
          if (atlChartFilterStore.xZoomStartValue === undefined) {
            atlChartFilterStore.xZoomStart = zoomCntrl.start
          }
          // Only capture data values if we don't already have valid values stored
          // (to avoid overwriting good values with recalculated ones after axis changes)
          if (
            atlChartFilterStore.xZoomStartValue === undefined &&
            zoomCntrl.startValue !== undefined &&
            typeof zoomCntrl.startValue === 'number'
          ) {
            atlChartFilterStore.xZoomStartValue = zoomCntrl.startValue
          }
          //logger.debug(`initScatterPlotWith ${reqId} xZoomStart:`, atlChartFilterStore.xZoomStart);
        }
        if (zoomCntrl.yAxisIndex !== undefined) {
          // Only update percentage if we don't have value-based zoom active
          if (atlChartFilterStore.yZoomStartValue === undefined) {
            atlChartFilterStore.yZoomStart = zoomCntrl.start
          }
          // Only capture data values if we don't already have valid values stored
          if (
            atlChartFilterStore.yZoomStartValue === undefined &&
            zoomCntrl.startValue !== undefined &&
            typeof zoomCntrl.startValue === 'number'
          ) {
            atlChartFilterStore.yZoomStartValue = zoomCntrl.startValue
          }
          //logger.debug(`initScatterPlotWith ${reqId} yZoomStart:`, atlChartFilterStore.yZoomStart);
        }
      }
      if (zoomCntrl.end !== undefined) {
        logger.debug('Zoom control end', {
          reqId,
          zoomNdx,
          end: zoomCntrl.end,
          endValue: zoomCntrl.endValue
        })
        if (zoomCntrl.xAxisIndex !== undefined) {
          // Only update percentage if we don't have value-based zoom active
          if (atlChartFilterStore.xZoomEndValue === undefined) {
            atlChartFilterStore.xZoomEnd = zoomCntrl.end
          }
          // Only capture data values if we don't already have valid values stored
          if (
            atlChartFilterStore.xZoomEndValue === undefined &&
            zoomCntrl.endValue !== undefined &&
            typeof zoomCntrl.endValue === 'number'
          ) {
            atlChartFilterStore.xZoomEndValue = zoomCntrl.endValue
          }
          //logger.debug(`initScatterPlotWith ${reqId} xZoomEnd:`, atlChartFilterStore.xZoomEnd);
        }
        if (zoomCntrl.yAxisIndex !== undefined) {
          // Only update percentage if we don't have value-based zoom active
          if (atlChartFilterStore.yZoomEndValue === undefined) {
            atlChartFilterStore.yZoomEnd = zoomCntrl.end
          }
          // Only capture data values if we don't already have valid values stored
          if (
            atlChartFilterStore.yZoomEndValue === undefined &&
            zoomCntrl.endValue !== undefined &&
            typeof zoomCntrl.endValue === 'number'
          ) {
            atlChartFilterStore.yZoomEndValue = zoomCntrl.endValue
          }
          //logger.debug(`initScatterPlotWith ${reqId} yZoomEnd:`, atlChartFilterStore.yZoomEnd);
        }
      }
    }
  }
  logger.debug('initScatterPlotWith: After capture, BEFORE clearPlot', {
    reqId,
    afterYStart: atlChartFilterStore.yZoomStart,
    afterYEnd: atlChartFilterStore.yZoomEnd,
    afterYStartValue: atlChartFilterStore.yZoomStartValue,
    afterYEndValue: atlChartFilterStore.yZoomEndValue
  })
  //logger.debug(`initScatterPlotWith for reqId:${reqId} SAVED VALUES: xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);

  //logger.debug(`initScatterPlotWith ${reqId} y_options:`, y_options);
  atlChartFilterStore.setShowMessage(false)
  if (!y_options.length || y_options[0] === 'not_set') {
    logger.debug('No y options selected (UI message will be displayed)', { reqId })
    atlChartFilterStore.setShowMessage(true)
    atlChartFilterStore.setIsWarning(true)
    atlChartFilterStore.setMessage('No Y options selected')
  } else {
    try {
      atlChartFilterStore.setIsLoading()
      clearPlot()
      //logger.debug(`initScatterPlotWith for reqId:${reqId} AFTER CLEARPLOT xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
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
  delete options.dataZoom // Don't include dataZoom - let it come from store values
  //logger.debug('removeUnusedOptions returning options:', options);
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
    //logger.debug(`appendSeries(${reqIdStr}): existingOptions:`,existingOptions,` filteredOptions:`, filteredOptions);
    // Fetch series data for the given reqIdStr
    const seriesData = await getSeriesFor(reqIdStr, true) //isOverlay=true
    if (!seriesData.length) {
      logger.warn('No series data found', { reqId: reqIdStr })
      return
    }
    //logger.debug(`appendSeries(${reqIdStr}): seriesData:`, seriesData);
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
    //logger.debug(`appendSeries(${reqIdStr}): heightSeriesData:`, heightSeriesData);
    //logger.debug(`appendSeries(${reqIdStr}): nonHeightSeriesData:`, nonHeightSeriesData);
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
    // Build dataZoom from store values to preserve zoom state
    const atlChartFilterStore = useAtlChartFilterStore()
    const dataZoomConfig = [
      {
        type: 'slider' as const,
        xAxisIndex: 0,
        filterMode: 'filter' as const,
        bottom: 1,
        ...(atlChartFilterStore.xZoomStartValue !== undefined &&
        atlChartFilterStore.xZoomEndValue !== undefined
          ? {
              startValue: atlChartFilterStore.xZoomStartValue,
              endValue: atlChartFilterStore.xZoomEndValue
            }
          : { start: atlChartFilterStore.xZoomStart, end: atlChartFilterStore.xZoomEnd })
      },
      {
        type: 'slider' as const,
        yAxisIndex: updatedYAxis.length > 1 ? [0, 1] : 0,
        filterMode: 'filter' as const,
        left: '95%',
        width: 20,
        showDataShadow: false,
        ...(atlChartFilterStore.yZoomStartValue !== undefined &&
        atlChartFilterStore.yZoomEndValue !== undefined
          ? {
              startValue: atlChartFilterStore.yZoomStartValue,
              endValue: atlChartFilterStore.yZoomEndValue
            }
          : { start: atlChartFilterStore.yZoomStart, end: atlChartFilterStore.yZoomEnd })
      },
      {
        type: 'inside' as const,
        xAxisIndex: 0,
        filterMode: 'filter' as const,
        ...(atlChartFilterStore.xZoomStartValue !== undefined &&
        atlChartFilterStore.xZoomEndValue !== undefined
          ? {
              startValue: atlChartFilterStore.xZoomStartValue,
              endValue: atlChartFilterStore.xZoomEndValue
            }
          : { start: atlChartFilterStore.xZoomStart, end: atlChartFilterStore.xZoomEnd })
      },
      {
        type: 'inside' as const,
        yAxisIndex: updatedYAxis.length > 1 ? [0, 1] : 0,
        filterMode: 'filter' as const,
        ...(atlChartFilterStore.yZoomStartValue !== undefined &&
        atlChartFilterStore.yZoomEndValue !== undefined
          ? {
              startValue: atlChartFilterStore.yZoomStartValue,
              endValue: atlChartFilterStore.yZoomEndValue
            }
          : { start: atlChartFilterStore.yZoomStart, end: atlChartFilterStore.yZoomEnd })
      }
    ]

    chart.setOption(
      {
        ...filteredOptions,
        legend: updatedLegend,
        series: updatedSeries,
        yAxis: updatedYAxis,
        dataZoom: dataZoomConfig
      },
      { notMerge: true, lazyUpdate: false }
    )

    // Force ECharts to complete progressive rendering by dispatching dataZoom actions.
    // Progressive rendering can get "stuck" when adding overlay series. Dispatching
    // dataZoom forces ECharts to re-process and render all visible data.
    setTimeout(() => {
      if (chart && !chart.isDisposed()) {
        // Dispatch dataZoom to force re-render of all data
        // Use value-based zoom when available (from drag rectangle), otherwise use percentages
        const xZoomAction: any = {
          type: 'dataZoom',
          dataZoomIndex: 0
        }
        if (
          atlChartFilterStore.xZoomStartValue !== undefined &&
          atlChartFilterStore.xZoomEndValue !== undefined
        ) {
          xZoomAction.startValue = atlChartFilterStore.xZoomStartValue
          xZoomAction.endValue = atlChartFilterStore.xZoomEndValue
        } else {
          xZoomAction.start = atlChartFilterStore.xZoomStart
          xZoomAction.end = atlChartFilterStore.xZoomEnd
        }
        chart.dispatchAction(xZoomAction)

        const yZoomAction: any = {
          type: 'dataZoom',
          dataZoomIndex: 1
        }
        if (
          atlChartFilterStore.yZoomStartValue !== undefined &&
          atlChartFilterStore.yZoomEndValue !== undefined
        ) {
          yZoomAction.startValue = atlChartFilterStore.yZoomStartValue
          yZoomAction.endValue = atlChartFilterStore.yZoomEndValue
        } else {
          yZoomAction.start = atlChartFilterStore.yZoomStart
          yZoomAction.end = atlChartFilterStore.yZoomEnd
        }
        chart.dispatchAction(yZoomAction)
      }
    }, 150)

    //logger.debug(`appendSeries ${reqId} AFTER options:`, chart.getOption());

    // DO NOT re-capture zoom values here! When ECharts updates the axis range, it automatically
    // recalculates startValue/endValue based on the NEW range, which gives us wrong values.
    // We want to keep the original user-selected data window values that were captured
    // in initScatterPlotWith BEFORE the axis range changed.
    logger.debug('appendSeries: Keeping original zoom values (not re-capturing)', {
      reqId,
      yZoomStart: useAtlChartFilterStore().yZoomStart,
      yZoomEnd: useAtlChartFilterStore().yZoomEnd,
      yZoomStartValue: useAtlChartFilterStore().yZoomStartValue,
      yZoomEndValue: useAtlChartFilterStore().yZoomEndValue
    })

    //logger.debug( `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,chart.getOption());
  } catch (error) {
    logger.error('Error appending scatter series', {
      reqId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export const addOverlaysToScatterPlot = async () => {
  const startTime = performance.now()
  //logger.debug(`addOverlaysToScatterPlot for: ${msg}`);
  // Retrieve existing options from the chart
  const plotRef = useAtlChartFilterStore().getPlotRef()
  if (plotRef && plotRef.chart) {
    const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds()
    //logger.debug(`addOverlaysToScatterPlot reqIds:`, reqIds);
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

  // Only refresh when on Time Series or Elevation Plot tabs where the chart is actually visible
  const activeTabStore = useActiveTabStore()
  if (!activeTabStore.isActiveTabTimeSeries && !activeTabStore.isActiveTabElevation) {
    logger.debug('Skipping refreshScatterPlot - not on Time Series or Elevation Plot tab')
    return
  }

  const recTreeStore = useRecTreeStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const plotRef = atlChartFilterStore.getPlotRef()
  if (plotRef) {
    if (plotRef.chart) {
      await initScatterPlotWith(recTreeStore.selectedReqId)
      await addOverlaysToScatterPlot()
    } else {
      logger.debug(
        'Ignoring refreshScatterPlot with no chart to refresh, plotRef.chart is undefined'
      )
    }
  } else {
    logger.debug('Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined')
  }
}

export async function getPhotonOverlayRunContext(): Promise<SrRunContext> {
  const recTreeStore = useRecTreeStore()
  const atlChartFilterStore = useAtlChartFilterStore()
  const requestsStore = useRequestsStore()
  const globalChartStore = useGlobalChartStore()
  //logger.debug('getPhotonOverlayRunContext reqId',recTreeStore.selectedReqId,', reqIdStr:', recTreeStore.selectedReqIdStr, ' chartStore.stateByReqId:', useChartStore().stateByReqId[recTreeStore.selectedReqIdStr]);
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
    const reqId = await indexedDb.findCachedRec(runContext, !useAtlChartFilterStore().excludeAtl08)
    //logger.debug('Show Photon Cloud is set; got this from cache -> reqId:', reqId);
    if (reqId && reqId > 0) {
      // Use the cached request
      runContext.reqId = reqId
      logger.debug('findCachedRec reqId found', { reqId, runContext })
      // Note: setSelectedOverlayedReqIds is called in handlePhotonCloudShow AFTER initializeColorEncoding
      // to avoid showing the overlay gradient dialog before color encoding is set
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
  const plotConfigStore = usePlotConfigStore()
  const symbolStore = useSymbolStore()
  const func = await indexedDb.getFunc(req_id)
  symbolStore.setSize(reqIdStr, plotConfigStore.getDefaultSymbolSize(func))
  return symbolStore.getSize(reqIdStr)
}

export function updateWhereClauseAndXData(req_id: number) {
  //logger.debug('updateWhereClauseAndXData req_id:', req_id);
  if (req_id <= 0) {
    logger.warn('Invalid request ID', { req_id })
    return
  }
  try {
    const reqIdStr = req_id.toString()
    //logger.debug('updateWhereClauseAndXData req_id:', req_id);
    const func = useRecTreeStore().findApiForReqId(req_id)
    const chartStore = useChartStore()
    const globalChartStore = useGlobalChartStore()
    const activeTabStore = useActiveTabStore()

    // Pass useTimeForXAxis to determine x-axis field, but NOT for Time Series tab
    // Time Series already uses time natively and should not be affected by this toggle
    const useTimeForXAxis = activeTabStore.isActiveTabTimeSeries
      ? false
      : globalChartStore.useTimeForXAxis
    chartStore.setXDataForChartUsingFunc(reqIdStr, func, useTimeForXAxis)

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
  //logger.debug('checkAndSetFilterForTimeSeries called');
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
    //logger.debug('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to:',globalChartStore.getSelectedCycleOptions(),'/', globalChartStore.getCycles());
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
      //logger.debug('checkAndSetFilterForTimeSeries Setting use_y_atc_filter false, Spots to [1,2,3,4,5,6], Cycles to all');
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

// Track the last highlighted data index for cleanup
let lastHighlightedDataIndex: number | null = null

/**
 * Highlight a point on the plot by matching lat/lon coordinates from map hover
 * Uses exact coordinate matching since map and plot share the same data source
 */
export function highlightPlotPointByCoordinates(lat: number, lon: number, reqIdStr: string): void {
  const atlChartFilterStore = useAtlChartFilterStore()
  const plotRef = atlChartFilterStore.getPlotRef()

  if (!plotRef?.chart) {
    logger.debug('highlightPlotPointByCoordinates: no chart available')
    return
  }

  // Get dimensions directly from the chart series options
  const options = plotRef.chart.getOption()
  const series = options.series as { data?: (number | string)[][]; dimensions?: string[] }[]
  const dimensions = series?.[0]?.dimensions
  const seriesData = series?.[0]?.data

  if (!dimensions || !Array.isArray(dimensions)) {
    logger.debug('highlightPlotPointByCoordinates: no dimensions in series')
    return
  }

  if (!seriesData || !Array.isArray(seriesData)) {
    logger.debug('highlightPlotPointByCoordinates: no series data')
    return
  }

  const fieldNameStore = useFieldNameStore()
  const reqId = parseInt(reqIdStr)
  const latFieldName = fieldNameStore.getLatFieldName(reqId)
  const lonFieldName = fieldNameStore.getLonFieldName(reqId)

  // Find lat/lon indices from dimensions array
  const latIdx = dimensions.indexOf(latFieldName)
  const lonIdx = dimensions.indexOf(lonFieldName)

  if (latIdx === -1 || lonIdx === -1) {
    logger.warn('Lat/lon not found in dimensions', { latFieldName, lonFieldName, dimensions })
    return
  }

  // Find matching point by exact lat/lon (same data source, so should match exactly)
  let matchedIndex = -1
  for (let i = 0; i < seriesData.length; i++) {
    const point = seriesData[i]
    const pointLat = point[latIdx] as number
    const pointLon = point[lonIdx] as number

    // Use exact match since coordinates come from the same data source
    if (pointLat === lat && pointLon === lon) {
      matchedIndex = i
      break
    }
  }

  if (matchedIndex >= 0 && matchedIndex !== lastHighlightedDataIndex) {
    //logger.debug('highlightPlotPointByCoordinates: highlighting point', { matchedIndex, lat, lon })

    // Downplay any previous highlight
    if (lastHighlightedDataIndex !== null) {
      plotRef.chart.dispatchAction({
        type: 'downplay',
        seriesIndex: 0,
        dataIndex: lastHighlightedDataIndex
      })
    }

    // Highlight the matched point (tooltip only shown on direct plot hover, not map hover)
    plotRef.chart.dispatchAction({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: matchedIndex
    })

    lastHighlightedDataIndex = matchedIndex
  } else if (matchedIndex < 0) {
    logger.debug('highlightPlotPointByCoordinates: no match found', {
      lat,
      lon,
      seriesDataLength: seriesData.length
    })
  }
}

/**
 * Clear any highlighted point on the plot
 */
export function clearPlotHighlight(): void {
  const atlChartFilterStore = useAtlChartFilterStore()
  const plotRef = atlChartFilterStore.getPlotRef()

  if (!plotRef?.chart) {
    return
  }

  if (lastHighlightedDataIndex !== null) {
    plotRef.chart.dispatchAction({
      type: 'downplay',
      seriesIndex: 0,
      dataIndex: lastHighlightedDataIndex
    })
    plotRef.chart.dispatchAction({
      type: 'hideTip'
    })
    lastHighlightedDataIndex = null
  }
}

/**
 * Build a SQL SELECT clause from current store values.
 * This function is decoupled from plot rendering and can be called independently.
 * Properly handles:
 * - Column quoting
 * - Geometry column extraction (ST_X/ST_Y/ST_Z for lat/lon/height)
 * - Time field inclusion
 *
 * @param reqIdStr - Request ID string
 * @returns SQL SELECT...FROM clause, or empty string if data not available
 */
export async function buildSelectClauseFromStore(reqIdStr: string): Promise<string> {
  const chartStore = useChartStore()
  const fieldNameStore = useFieldNameStore()
  const reqId = parseInt(reqIdStr)

  const fileName = chartStore.getFile(reqIdStr)
  const xColumn = chartStore.getXDataForChart(reqIdStr)
  const yColumns = chartStore.getYDataOptions(reqIdStr)

  if (!fileName || !xColumn) {
    return ''
  }

  // Get field names for special handling
  const latFieldName = fieldNameStore.getLatFieldName(reqId)
  const lonFieldName = fieldNameStore.getLonFieldName(reqId)
  const heightFieldName = fieldNameStore.getHFieldName(reqId)
  const timeFieldName = fieldNameStore.getTimeFieldName(reqId)

  // Get DuckDB client and column types to detect geometry
  const duckDbClient = await createDuckDbClient()
  await duckDbClient.insertOpfsParquet(fileName)
  const colTypes = await duckDbClient.queryColumnTypes(fileName)
  const geometryInfo = getGeometryInfo(colTypes, reqId)
  const hasGeometry = geometryInfo?.hasGeometry ?? false

  // Build column list: x column + y columns
  const allColumns = [xColumn, ...yColumns].filter(Boolean)

  // Ensure time field is included if not already present
  if (timeFieldName && !allColumns.includes(timeFieldName)) {
    allColumns.push(timeFieldName)
  }

  // Build column expressions using shared helper
  const columnExpressions = buildColumnExpressions(allColumns, {
    hasGeometry,
    geometryInfo,
    latFieldName,
    lonFieldName,
    heightFieldName,
    escape: duckDbClient.escape,
    getType: (col) => colTypes.find((c) => c.name === col)?.type ?? ''
  })

  const columnsStr = columnExpressions.join(', ')
  return `SELECT ${columnsStr} \nFROM '${fileName}'`
}
