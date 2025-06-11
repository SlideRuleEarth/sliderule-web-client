import { useChartStore } from "@/stores/chartStore";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { fetchScatterData,setDataOrder } from "@/utils/SrDuckDbUtils";
import { type EChartsOption, type LegendComponentOption, type ScatterSeriesOption, type EChartsType, number } from 'echarts';
import { createWhereClause } from "./spotUtils";
import type { ECharts } from 'echarts/core';
import { duckDbReadAndUpdateSelectedLayer } from '@/utils/SrDuckDbUtils';
import { type SrRunContext } from '@/db/SlideRuleDb';
import type { SrScatterChartDataArray,FetchScatterDataOptions } from '@/utils/SrDuckDbUtils';
import type { WritableComputedRef } from "vue";
import { reactive, computed } from 'vue';
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useRequestsStore } from "@/stores/requestsStore";
import { useGradientColorMapStore } from "@/stores/gradientColorMapStore";
import { useAtl03CnfColorMapStore } from "@/stores/atl03CnfColorMapStore";
import { useAtl08ClassColorMapStore } from "@/stores/atl08ClassColorMapStore";
import { useAtl24ClassColorMapStore } from "@/stores/atl24ClassColorMapStore";
import { formatKeyValuePair } from '@/utils/formatUtils';
import { SELECTED_LAYER_NAME_PREFIX,type MinMax, type MinMaxLowHigh } from "@/types/SrTypes";
import { useSymbolStore } from "@/stores/symbolStore";
import { useFieldNameStore } from "@/stores/fieldNameStore";
import { createDuckDbClient } from "@/utils/SrDuckDb";

export const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
export const yDataSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const yColorEncodeSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const solidColorSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const showYDataMenuReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({});
export const showUseSelectedMinMaxReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({});


export const selectedCyclesReactive = computed({
    get: (): number[] => {
        const value = useGlobalChartStore().getCycles();
        //console.log(`selectedCyclesReactive[${reqId}] get:`, value);
        return value;
    },
    set: (values: number[]): void => {
        //console.log(`selectedCyclesReactive[${reqId}] set:`, values);
        useGlobalChartStore().setCycles(values);
    },
});

export const selectedRgtReactive = computed({
    get: (): number => {
        const value = useGlobalChartStore().getRgt();
        //console.log(`selectedRgtsReactive[${reqId}] get:`, value);
        return value ? value : 0;
    },
    set: (value: number): void => {
        //console.log(`selectedRgtsReactive[${reqId}] set:`, values);
        useGlobalChartStore().setRgt(value);
    },
});


export interface SrScatterSeriesData{
  series: {
    name: string;
    type: string;
    data: number[][];
    dimensions: string[];
    large: boolean;
    largeThreshold: number;
    animation: boolean;
    yAxisIndex: number;
    symbolSize?: number;
    progressive?: number;
    progressiveThreshold?: number;
    progressiveChunkMode?: string;
    itemStyle?: {
        color: string | ((params: any) => string);
    };
    encode?: {
      x: number;
      y: number;
    };
    z?: number;
  };
  min: number | null;
  max: number | null;  
};

export function getDefaultColorEncoding(reqId:number,parentFuncStr?:string) {
    const func = useRecTreeStore().findApiForReqId(reqId);
    return useFieldNameStore().getDefaultColorEncoding(func,parentFuncStr);
}

export function initializeColorEncoding(reqId:number,parentFuncStr?:string) {
    const reqIdStr = reqId.toString();
    const chartStore = useChartStore();
    chartStore.setSelectedColorEncodeData(reqIdStr, getDefaultColorEncoding(reqId,parentFuncStr));
    //console.log(`initializeColorEncoding reqId:${reqIdStr} parentFuncStr:${parentFuncStr} chartStore.getSelectedColorEncodeData:`, chartStore.getSelectedColorEncodeData(reqIdStr));
}

export function initDataBindingsToChartStore(reqIds: string[]) {
    //console.log('initDataBindingsToChartStore:', reqIds);
    const chartStore = useChartStore();
    const globalChartStore = useGlobalChartStore();
    reqIds.forEach((reqId) => {
        if (!(reqId in yDataBindingsReactive)) {
            yDataBindingsReactive[reqId] = computed({
                get: () => chartStore.getYDataOptions(reqId),
                set: (value: string[]) => chartStore.setYDataOptions(reqId, value),
            });
        }
        if(!(reqId in yDataSelectedReactive)){
            yDataSelectedReactive[reqId] = computed({
                get: () => chartStore.getSelectedYData(reqId),
                set: (value: string) => chartStore.setSelectedYData(reqId, value),
            });
        }
        if(!(reqId in yColorEncodeSelectedReactive)){
            yColorEncodeSelectedReactive[reqId] = computed({
                get: () => chartStore.getSelectedColorEncodeData(reqId),
                set: (value: string) => chartStore.setSelectedColorEncodeData(reqId, value),
            });
        }
        if(!(reqId in solidColorSelectedReactive)){
            solidColorSelectedReactive[reqId] = computed({
                get: () => chartStore.getSolidSymbolColor(reqId),
                set: (value: string) => chartStore.setSolidSymbolColor(reqId, value),
            });
        }
        if(!(reqId in showYDataMenuReactive)){
            showYDataMenuReactive[reqId] = computed({
                get: () => chartStore.getShowYDataMenu(reqId),
                set: (value: boolean) => chartStore.setShowYDataMenu(reqId, value),
            });
        }
        if(!(reqId in showUseSelectedMinMaxReactive)){
            showUseSelectedMinMaxReactive[reqId] = computed({
                get: () => chartStore.getUseSelectedMinMax(reqId),
                set: (value: boolean) => chartStore.setUseSelectedMinMax(reqId, value),
            });
        }
    });
}

interface GetSeriesParams {
    reqIdStr: string;
    fileName: string;
    x: string;
    y: string[];
    fetchOptions: FetchScatterDataOptions; 
    // The name of the function to fetch data:
    fetchData: (
        reqIdStr: string,
        fileName: string,
        x: string,
        y: string[],
        fetchOptions: FetchScatterDataOptions 
    ) => Promise<{
        chartData: Record<string, SrScatterChartDataArray>;
        minMaxLowHigh: MinMaxLowHigh;
        normalizedMinMaxValues: MinMaxLowHigh;
        dataOrderNdx: Record<string, number>;
    }>;
    // The property name for minMax or normalizedMinMax
    minMaxProperty: 'minMaxLowHigh' | 'normalizedMinMaxValues';
    // A function or color for the series item style
    colorFunction?: (params: any) => string;
    // Additional ECharts config
    zValue: number;
    // Logging prefix for console
    functionName: string;
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
    functionName,
}: GetSeriesParams): Promise<SrScatterSeriesData[]> {
    const startTime = performance.now();
    let yItems: SrScatterSeriesData[] = [];
    const plotConfig = await indexedDb.getPlotConfig();
    const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
    const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
    const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';

    try {
        const { chartData = {}, ...rest } = await fetchData(reqIdStr, fileName, x, y, fetchOptions);
        //console.log(`${functionName} ${reqIdStr} ${y}: chartData:`, chartData, 'fetchOptions:', fetchOptions);
        // e.g. choose minMax based on minMaxProperty
        const minMaxLowHigh = rest['minMaxLowHigh'] || {};
        const minMaxValues = rest[minMaxProperty] || {};
        //console.log(`getGenericSeries ${functionName}: minMaxValues:`, minMaxValues);
        const chartStore = useChartStore();
        chartStore.setMinMaxValues(reqIdStr, minMaxValues);
        chartStore.setMinMaxLowHigh(reqIdStr, minMaxLowHigh);
        chartStore.setDataOrderNdx(reqIdStr, rest['dataOrderNdx'] || {});
        const gradientColorMapStore = useGradientColorMapStore(reqIdStr);
        gradientColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
        atl03CnfColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
        atl08ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr);
        atl24ClassColorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn(`${functionName} ${reqIdStr}: chartData or minMax is empty, skipping processing.`);
            return yItems;
        }
        if(!colorFunction){
            const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
            let thisColorFunction;
            if(cedk === 'solid'){
                thisColorFunction = (params: any) => chartStore.getSolidSymbolColor(reqIdStr);
            } else {
                //console.log(`getGenericSeries: chartStore.getSelectedColorEncodeData(reqIdStr):`, chartStore.getSelectedColorEncodeData(reqIdStr));
                //console.log(`getGenericSeries: chartStore.getMinMaxValues(reqIdStr):`, chartStore.getMinMaxValues(reqIdStr));
                let minValue = chartStore.getLow(reqIdStr, cedk);
                let maxValue = chartStore.getHigh(reqIdStr, cedk);
                if(!chartStore.getUseSelectedMinMax(reqIdStr)){
                    minValue = useGlobalChartStore().getLow(cedk);
                    maxValue = useGlobalChartStore().getHigh(cedk);
                }
                thisColorFunction = gradientColorMapStore.createGradientColorFunction(cedk,minValue,maxValue);
            }
            colorFunction = thisColorFunction;
        }
        //console.log(`${functionName}: colorFunction:`, colorFunction);
        // Get the selected Y data name
        const ySelectedName = chartStore.getSelectedYData(reqIdStr);

        if (y.includes(ySelectedName)) {
            const yIndex =  gradientColorMapStore.getDataOrderNdx()[ySelectedName];
            const data = chartData[reqIdStr].data; // get raw number[][] data
            const min = minMaxValues[ySelectedName]?.min ?? null;
            const max = minMaxValues[ySelectedName]?.max ?? null;
            //console.log(`${functionName}: Index of selected Y data "${ySelectedName}" in Y array is ${yIndex}. Min: ${min}, Max: ${max}`, data);

            yItems.push({
                series: {
                    name: ySelectedName,
                    type: 'scatter',
                    data: data,
                    dimensions:[...gradientColorMapStore.getDimensions()], 
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
                    symbolSize: useSymbolStore().getSize(reqIdStr),
                },
                min,
                max,
            });

            const totalPoints = data.length;
            chartStore.setNumOfPlottedPnts(reqIdStr, totalPoints);
        } else {
            console.warn(`getGenericSeries ${functionName} ${reqIdStr} : selected Y data "${ySelectedName}" not found in provided Y array.`);
        }
    } catch (error) {
        console.error(`getGenericSeries ${functionName} ${reqIdStr} Error:`, error);
    } finally {
        const endTime = performance.now();
        console.log(`getGenericSeries ${functionName} ${reqIdStr} took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}

export async function getSeriesForAtl03sp(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
    const chartStore = useChartStore();
    const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
    const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
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
            chartStore.setMinX(reqId, 0);
            chartStore.setMaxX(
                reqId,
                row.max_x + row.max_segment_dist - row.min_segment_dist - row.min_x
            );
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
            const segMin = minMaxLowHigh['segment_dist']?.min || 0;
            const xVal = row[xCol] + row.segment_dist - segMin;
            orderNdx = setDataOrder(dataOrderNdx,'x',orderNdx);

            // Start with [xVal], then push each y
            const out = [xVal];
            for (const yName of yCols) {
                // If one of the yCols is actually "segment_dist" skip it.
                if (yName !== 'segment_dist') {
                    out.push(row[yName]);
                    orderNdx = setDataOrder(dataOrderNdx,yName,orderNdx);
                }
            }
            return [out,orderNdx];
        },
    };
    const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
    let thisColorFunction; // generic will set it if is not set here
    if(cedk === 'atl03_cnf'){
        thisColorFunction = atl03CnfColorMapStore.cachedColorFunction;
        // test the color function
        //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
        //const c1 = thisColorFunction({data:[-2]});
    } else if(cedk === 'atl08_class'){
        thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class;
    }
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);   
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,             // pass the specialized logic above
        fetchData: fetchScatterData,
        minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
        colorFunction: thisColorFunction, 
        zValue: 0,
        functionName: 'getSeriesForAtl03sp', // for the log
    });
}

export async function getSeriesForAtl03x(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[],
    parentMinX?: number
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03sp reqIdStr:', reqIdStr,'x:',x,'y:',y);
    const chartStore = useChartStore();
    const atl03CnfColorMapStore = await useAtl03CnfColorMapStore(reqIdStr);
    const atl24ClassColorMapStore = await useAtl24ClassColorMapStore(reqIdStr);
    const atl08ClassColorMapStore = await useAtl08ClassColorMapStore(reqIdStr);
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true, parentMinX: parentMinX};
    const cedk = chartStore.getSelectedColorEncodeData(reqIdStr);
    let thisColorFunction; // generic will set it if is not set here
    if(cedk === 'atl03_cnf'){
        thisColorFunction = atl03CnfColorMapStore.cachedColorFunction;
        // test the color function
        //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);
        //const c1 = thisColorFunction({data:[-2]});
    } else if(cedk === 'atl08_class'){
        thisColorFunction = atl08ClassColorMapStore.getColorUsingAtl08_class;
    } else if(cedk === 'atl24_class'){
        thisColorFunction = atl24ClassColorMapStore.getColorUsingAtl24_class;
    }
    //console.log(`getSeriesForAtl03sp ${reqIdStr} cedk:`,cedk,'thisColorFunction:',thisColorFunction);   
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,             // pass the specialized logic above
        fetchData: fetchScatterData,
        minMaxProperty: 'minMaxLowHigh', // read from minMaxValues rather than normalizedMinMaxValues
        colorFunction: thisColorFunction, 
        zValue: 0,
        functionName: 'getSeriesForAtl03x', // for the log
    });
}

async function getSeriesForAtl03vp(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData,         
    minMaxProperty: 'minMaxLowHigh', // note the difference
    zValue: 10,                               
    functionName: 'getSeriesForAtl03vp',
});
}

async function getSeriesForAtl06(
        reqIdStr: string,
        fileName: string,
        x: string,
        y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', // note the difference
        zValue: 10,                               // z value for ATL06
        functionName: 'getSeriesForAtl06',
    });
}

async function getSeriesForAtl08(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', 
        zValue: 10,                               // z value for ATL06
        functionName: 'getSeriesForAtl08',
    });
}

async function getSeriesForAtl24(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,
        fetchData: fetchScatterData,         // function to fetch data
        minMaxProperty: 'normalizedMinMaxValues', 
        zValue: 10,                               // z value for ATL24
        functionName: 'getSeriesForAtl24',
    });
}

async function getSeriesForGedi(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[]
): Promise<SrScatterSeriesData[]> {
    console.log(`getSeriesForGedi ${reqIdStr} fileName:`,fileName);
const fetchOptions:FetchScatterDataOptions  = {normalizeX: true};
return getGenericSeries({
    reqIdStr,
    fileName,
    x,
    y,
    fetchOptions,
    fetchData: fetchScatterData,         // function to fetch data
    minMaxProperty: 'normalizedMinMaxValues', // note the difference
    zValue: 10,                               // z value for ATL06
    functionName: 'getSeriesForGedi',
});
}

export function clearPlot() {
    const atlChartFilterStore = useAtlChartFilterStore();
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef) {
        if(plotRef.chart){
            plotRef.chart.clear();
            console.log('clearPlot: plotRef.chart cleared');
        } else {
            console.warn('clearPlot: plotRef.chart is undefined');
        }
    } else {
        console.warn('clearPlot: plotRef is undefined');
    }
}

function filterDataForPos(label:any, data:any,lat:string,lon:string) {
    //console.log('filterDataForPos label:', label, 'data:', data);
    //console.log('filterDataForPos BEFORE lat:',  useGlobalChartStore().locationFinderLat, 'lon:', useGlobalChartStore().locationFinderLon);
    if(label === lat){
        useGlobalChartStore().locationFinderLat = data;
    } else if(label === lon){
        useGlobalChartStore().locationFinderLon = data;
    }
    //console.log('filterDataForPos AFTER  lat:',  useGlobalChartStore().locationFinderLat, 'lon:', useGlobalChartStore().locationFinderLon);
}

export function formatTooltip(params: any,latFieldName:string,lonFieldName:string) {
  const paramsData = params.data;
  const paramsDim = params.dimensionNames as string[];
  let ndx = 0;

  const parms = paramsDim
    .map((dim) => {
      const val = paramsData[ndx++];
      filterDataForPos(dim, val,latFieldName,lonFieldName);
      return formatKeyValuePair(dim, val);
    })
    .join('<br>');
    //console.log('formatTooltip parms:', parms);
    return parms;
}

async function getSeriesFor(reqIdStr:string,isOverlay=false) : Promise<SrScatterSeriesData[]>{
    const chartStore = useChartStore();
    const startTime = performance.now(); 
    const fileName = chartStore.getFile(reqIdStr);
    const reqId = Number(reqIdStr);
    const func = useRecTreeStore().findApiForReqId(reqId);
    const x = chartStore.getXDataForChart(reqIdStr);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const existingColumns = await duckDbClient.queryForColNames(fileName);
    const all_y = chartStore.getYDataOptions(reqIdStr);
    const y = all_y.filter(col => existingColumns.includes(col));
    console.log('all_y:', all_y);
    console.log('existingColumns:', existingColumns);
    console.log('Filtered y:', y);
    console.log('getSeriesFor Using y:',y);
    if(y.length != all_y.length){
        console.warn(`getSeriesFor ${reqIdStr} y length mismatch: all_y.length=${all_y.length}, existingColumns.length=${existingColumns.length}, y.length=${y.length}`);
    }
    let seriesData = [] as SrScatterSeriesData[];
    let minXToUse;
    if(isOverlay){
        const rc = await indexedDb.getRunContext(reqId);
        if(rc){
            if(rc.parentReqId){
                minXToUse = chartStore.getRawMinX(rc.parentReqId.toString());
                console.log(`getSeriesFor ${reqIdStr} isOverlay: true, minXToUse (from parent:${rc.parentReqId}): ${minXToUse}`);
            }
        }
    }
    try{
        if(fileName){
            if(func==='atl03sp'){
                seriesData = await getSeriesForAtl03sp(reqIdStr, fileName, x, y);
            } else if(func==='atl03vp'){
                seriesData = await getSeriesForAtl03vp(reqIdStr, fileName, x, y);
            } else if(func==='atl03x'){
                seriesData = await getSeriesForAtl03x(reqIdStr, fileName, x, y, minXToUse);
            } else if(func.includes('atl06')){
                seriesData = await getSeriesForAtl06(reqIdStr, fileName, x, y);
            } else if(func.includes('atl08')){
                seriesData = await getSeriesForAtl08(reqIdStr, fileName, x, y);
            } else if(func.includes('atl24')){
                seriesData = await getSeriesForAtl24(reqIdStr, fileName, x, y);
            } else if(func.includes('gedi')){
                seriesData = await getSeriesForGedi(reqIdStr, fileName, x, y);
            } else {
                console.error(`getSeriesFor ${reqIdStr} invalid func:`, func);
            }
            if(seriesData.length === 0){
                console.warn(`getSeriesFor ${reqIdStr} seriesData is empty`);
            }
            //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
        } else {
            console.warn(`getSeriesFor ${reqIdStr} fileName is null`);
        }
    } catch (error) {
        console.error('getSeriesFor Error:', error);
    } finally {
        const endTime = performance.now(); 
        console.log(`getSeriesFor ${reqIdStr} fileName:${fileName} took ${endTime - startTime} milliseconds. seriesData.length:`, seriesData.length);
        //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
    }
    return seriesData;
}

export async function initChartStoreFor(reqId:number) : Promise<boolean>{
    const chartStore = useChartStore();
    const reqIdStr = reqId.toString();
    let status = true;
    if (reqId <= 0) {
        console.warn('Invalid request ID:', reqId);
        return false;
    }

    try {

        initializeColorEncoding(reqId);
        const request = await indexedDb.getRequest(reqId);

        if (!request) {
            console.error(`No request found for reqId: ${reqIdStr}`, request);
            return false;
        }

        const { file, func, description, num_bytes, cnt } = request;

        if (file) {
            chartStore.setFile(reqIdStr, file);

        } else {
            console.error(`No file found for reqId: ${reqIdStr}`, request);
            status = false;
        }

        if (description) {
            chartStore.setDescription(reqIdStr, description);
        } // No warning needed for missing description.

        if (num_bytes) {
            chartStore.setSize(reqIdStr, num_bytes);
        } else {
            if(num_bytes===undefined){
                console.error(`No num_bytes found for reqId: ${reqIdStr}`, request);
                status = false;
            }
        }

        if (cnt) {
            chartStore.setRecCnt(reqIdStr, cnt);
        } else {
            if(cnt===undefined){
                console.error(`No cnt found for reqId: ${reqIdStr}`, request);
                status = false;
            }
        }
    } catch (error) {
        console.error(`Error processing reqId: ${reqIdStr}`, error);
        status = false;
    }
    return status;
}

export async function initChartStore() {
    const startTime = performance.now(); 
    const recTreeStore = useRecTreeStore();
    const chartStore = useChartStore();
    for (const reqIdItem of recTreeStore.reqIdMenuItems) {
        const reqIdStr = reqIdItem.value.toString();
        const reqId = Number(reqIdItem.value);
        const status = await initChartStoreFor(reqId);
        if(!status){
            console.error(`initChartStoreFor ${reqId} failed`);
        }
        await initSymbolSize(reqId);
    }
    const endTime = performance.now(); 
    console.log(`initChartStore took ${endTime - startTime} milliseconds.`);
}


export async function getScatterOptions(req_id:number): Promise<any> {
    const chartStore = useChartStore();
    const globalChartStore = useGlobalChartStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const startTime = performance.now(); 
    const reqIdStr = req_id.toString();
    const fileName = chartStore.getFile(reqIdStr);
    const y = chartStore.getYDataOptions(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const rgt = globalChartStore.getRgt();
    const cycles = useGlobalChartStore().getCycles();
    const spots = globalChartStore.getSpots();
    const latFieldName = useFieldNameStore().getLatFieldName(req_id);
    const lonFieldName = useFieldNameStore().getLonFieldName(req_id);
    const mission = useFieldNameStore().getMissionForReqId(req_id);
    const initLegendUnselected = chartStore.getInitLegendUnselected(reqIdStr);
    // Get the CSS variable value dynamically
    const primaryButtonColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--p-button-text-primary-color')
        .trim(); // Retrieve and trim the color value

    //console.log(`getScatterOptions for reqId:${reqIdStr} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
    let options = null;
    try{
        let seriesData = [] as SrScatterSeriesData[];
        if(mission === 'ICESat-2'){
            if(fileName){
                if(spots.length>0 && rgt>0 && cycles.length>0){
                    seriesData = await getSeriesFor(reqIdStr);
                } else {
                    console.warn('getScatterOptions Filter not set i.e. spots, rgts, or cycles is empty');
                }
            }
        } else if(mission === 'GEDI'){
            if(fileName){
                seriesData = await getSeriesFor(reqIdStr);
            }

        } else {
            console.error(`getScatterOptions ${reqIdStr} mission:${mission} not supported`);
        }
        if(seriesData.length !== 0){
            options = {
                title: {
                    text: globalChartStore.titleOfElevationPlot,
                    left: "center"
                },
                toolbox: {
                    show: true,
                    orient: "vertical",
                    left: 0,
                    top: 50,
                    feature: {
                        saveAsImage: {},
                        restore: {},
                        dataZoom: {},
                        dataView: { readOnly: true },
                    }
                },
                tooltip: {
                    trigger: "item",
                    formatter: (params: any) => formatTooltip(params,latFieldName,lonFieldName),
                },
                legend: {
                    data: seriesData.map(series => series.series.name),
                    selected: Object.fromEntries(
                        seriesData.map(series => [series.series.name, !initLegendUnselected])
                    ),
                    selectedMode: !initLegendUnselected,
                    left: 'left',
                    itemStyle: { color: primaryButtonColor }
                },
                notMerge: true,
                lazyUpdate: true,
                xAxis: [{
                    min: chartStore.getMinX(reqIdStr),
                    max: chartStore.getMaxX(reqIdStr),
                    name: chartStore.getXLegend(reqIdStr), // Add the label for the x-axis here
                    nameLocation: 'middle', // Position the label in the middle of the axis
                    nameTextStyle: {
                        fontSize: 10,
                        padding:[10,0,10,0],
                        margin:10,
                    },
                    axisLine:  {
                            onZero: false,
                    },
                }],
                yAxis: seriesData.map((series, index) => ({
                    type: 'value',
                    name: y[index],
                    min: seriesData[index].min,
                    max: seriesData[index].max,
                    scale: true,  // Add this to ensure the axis scales correctly
                    axisLabel: {
                        formatter: (value: number) => value.toFixed(1)  // Format to one decimal place
                    }
                })),
                series: seriesData.map(series => series.series),
                dataZoom: [
                    {
                        type: 'slider', // This creates a slider to zoom in the X-axis
                        xAxisIndex: 0,
                        filterMode: 'filter',
                        bottom: 1,
                        start: atlChartFilterStore.xZoomStart, // Start zoom level
                        end: atlChartFilterStore.xZoomEnd, // End zoom level
                    },
                    {
                        type: 'slider', // This creates a slider to zoom in the Y-axis
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0, // Adjusting for multiple y-axes if necessary
                        filterMode: 'filter',
                        left: '95%',
                        width: 20,
                        start: atlChartFilterStore.yZoomStart, // Start zoom level
                        end: atlChartFilterStore.yZoomEnd, // End zoom level
                        showDataShadow: false,
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        xAxisIndex: 0,
                        filterMode: 'filter',
                        start: atlChartFilterStore.xZoomStart, // Start zoom level
                        end: atlChartFilterStore.xZoomEnd, // End zoom level
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0,
                        filterMode: 'filter',
                        start: atlChartFilterStore.yZoomStart, // Start zoom level
                        end: atlChartFilterStore.yZoomEnd, // End zoom level
                    },
                ],            
            };
        } else {
            console.warn('getScatterOptions seriesData is empty');
        }
        //console.log('getScatterOptions options:', options);
    } catch (error) {
        console.error('getScatterOptions Error:', error);
    } finally {
        //console.log(`getScatterOptions options for: ${reqIdStr}:`, options);
        const endTime = performance.now(); 
        console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`,options);
        return options;
    }
}

export async function getScatterOptionsFor(reqId:number) {
    const atlChartFilterStore = useAtlChartFilterStore();
    //console.log(`getScatterOptionsFor for reqId:${reqId} xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
    const newScatterOptions = await getScatterOptions(reqId);
    if (!newScatterOptions) {
        atlChartFilterStore.setShowMessage(true);
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage(`reqId:${reqId} Failed to load data. Click on elevation in map to preset filters`);
        console.error(`getScatterOptionsFor ${reqId} Failed to load data. Click on elevation in map to preset filters`);
        return;
    }
    const plotRef = atlChartFilterStore.getPlotRef();

    if (Object.keys(newScatterOptions).length > 0) {
        if(plotRef?.chart){
            plotRef.chart.setOption(newScatterOptions);
            //console.log(`initScatterPlotWith Options applied to chart:`, newScatterOptions);
            const options = plotRef.chart.getOption();
            //console.log(`initScatterPlotWith ${reqId} Options from chart:`, options);
        } else {
            console.error(`getScatterOptionsFor ${reqId} plotRef.chart is undefined`);
        }
    } else {
        console.warn(`getScatterOptionsFor No valid options to apply to chart`);
    }
}

const initScatterPlotWith = async (reqId: number) => {
    const startTime = performance.now();
    const atlChartFilterStore = useAtlChartFilterStore();
    const chartStore = useChartStore();
    //console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

    if (reqId === undefined || reqId <= 0) {
        console.error(`initScatterPlotWith ${reqId} reqId is empty or invalid`);
        return;
    }
    await updateWhereClauseAndXData(reqId);
    const reqIdStr = reqId.toString();
    const y_options = chartStore.getYDataOptions(reqIdStr);
    const plotRef = atlChartFilterStore.getPlotRef();
    if (!plotRef?.chart) {
        console.warn(`appendSeries(${reqId.toString()}): plotRef or chart is undefined.`);
        return;
    }
    // Save the current zoom state of the chart before applying new options
    const chart: ECharts = plotRef.chart;
    const options = chart.getOption() as EChartsOption;
    //console.log(`initScatterPlotWith ${reqId} BEFORE options:`, options);
    const zoomCntrls = Array.isArray(options?.dataZoom) ? options.dataZoom : [options?.dataZoom];
    for(let zoomNdx = 0; zoomNdx < zoomCntrls.length; zoomNdx++) {
        const zoomCntrl = zoomCntrls[zoomNdx];//console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrls[zoomNdx]);            
        if(zoomCntrl) {
            zoomCntrl.filterMode = 'filter'; 
            //console.log(`initScatterPlotWith ALL ${reqId} zoomCntrls[${zoomNdx}]:`, zoomCntrl);
            if(zoomCntrl.start){
                console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}].start:`, zoomCntrl.start);
                if(zoomCntrl.xAxisIndex !== undefined){
                    atlChartFilterStore.xZoomStart = zoomCntrl.start;
                    //console.log(`initScatterPlotWith ${reqId} xZoomStart:`, atlChartFilterStore.xZoomStart);
                }
                if(zoomCntrl.yAxisIndex !== undefined){
                    atlChartFilterStore.yZoomStart = zoomCntrl.start;
                    //console.log(`initScatterPlotWith ${reqId} yZoomStart:`, atlChartFilterStore.yZoomStart);
                }
            }
            if(zoomCntrl.end){
                console.log(`initScatterPlotWith ${reqId} zoomCntrls[${zoomNdx}].end:`, zoomCntrl.end);
                if(zoomCntrl.xAxisIndex !== undefined){
                    atlChartFilterStore.xZoomEnd = zoomCntrl.end;
                    //console.log(`initScatterPlotWith ${reqId} xZoomEnd:`, atlChartFilterStore.xZoomEnd);
                }
                if(zoomCntrl.yAxisIndex !== undefined){
                    atlChartFilterStore.yZoomEnd = zoomCntrl.end;
                    //console.log(`initScatterPlotWith ${reqId} yZoomEnd:`, atlChartFilterStore.yZoomEnd);
                }
            } 
        }
    }
    //console.log(`initScatterPlotWith for reqId:${reqId} SAVED VALUES: xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);

    //console.log(`initScatterPlotWith ${reqId} y_options:`, y_options);
    const msg = '';
    atlChartFilterStore.setShowMessage(false);
    if (!y_options.length || y_options[0] === 'not_set') {
        console.warn(`initScatterPlotWith ${reqId} No y options selected`);
        atlChartFilterStore.setShowMessage(true);
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('No Y options selected');
    } else {
        try {
            atlChartFilterStore.setIsLoading();
            clearPlot();
            //console.log(`initScatterPlotWith for reqId:${reqId} AFTER CLEARPLOT xZoomStart:${atlChartFilterStore.xZoomStart} xZoomEnd:${atlChartFilterStore.xZoomEnd} yZoomStart:${atlChartFilterStore.yZoomStart} yZoomEnd:${atlChartFilterStore.yZoomEnd} `);
            await getScatterOptionsFor(reqId)
        } catch (error) {
            console.error(`initScatterPlotWith ${reqId} Error fetching scatter options:`, error);
            atlChartFilterStore.setShowMessage(true);
            atlChartFilterStore.setMessage('Failed to load data. Please try again later.');
        } finally {
            atlChartFilterStore.resetIsLoading();
        }
    }
    const endTime = performance.now();
    console.log(`initScatterPlotWith ${reqId} took ${endTime - startTime} milliseconds.`);
};

// This removes the defaulted values of unused toolbox, visualMap, timeline, and calendar options from the options object
function removeUnusedOptions(options:any):any { 
    if (!options) {
        return {};
    }
    delete options.visualMap;
    delete options.timeline;
    delete options.calendar;
    return options;
}

async function appendSeries(reqId: number): Promise<void> {
    try {
        //console.log(`appendSeries(${reqId})`);
        const reqIdStr = reqId.toString();
        const plotRef = useAtlChartFilterStore().getPlotRef();
        if (!plotRef?.chart) {
            console.warn(`appendSeries(${reqIdStr}): plotRef or chart is undefined.`);
            return;
        }
        const chart: ECharts = plotRef.chart;

        // Retrieve existing options from the chart
        const existingOptions = chart.getOption() as EChartsOption;
        const filteredOptions = removeUnusedOptions(existingOptions);
        //console.log(`appendSeries(${reqIdStr}): existingOptions:`,existingOptions,` filteredOptions:`, filteredOptions);
        // Fetch series data for the given reqIdStr
        const seriesData = await getSeriesFor(reqIdStr,true);//isOverlay=true
        if (!seriesData.length) {
            console.warn(`appendSeries(${reqIdStr}): No series data found.`);
            return;
        }
        //console.log(`appendSeries(${reqIdStr}): seriesData:`, seriesData);
        // Define the fields that should share a single axis
        const heightFields = ['height', 'h_mean', 'h_mean_canopy', 'h_li', 'ortho_h'];

        // Separate series into "height" group and "non-height" group
        const heightSeriesData = seriesData.filter(d => heightFields.includes(d.series.name));
        const nonHeightSeriesData = seriesData.filter(d => !heightFields.includes(d.series.name));
        //console.log(`appendSeries(${reqIdStr}): heightSeriesData:`, heightSeriesData);
        //console.log(`appendSeries(${reqIdStr}): nonHeightSeriesData:`, nonHeightSeriesData);
        let updatedSeries = [
            ...(Array.isArray(filteredOptions.series) ? filteredOptions.series : []),
        ];

        let updatedYAxis = Array.isArray(filteredOptions.yAxis)
            ? [...filteredOptions.yAxis]
            : [];

        // -----------------------------
        //     HANDLE Y-AXES MERGING
        // -----------------------------
        let heightYAxisIndex: number | null = null;
        let existingHeightFields: string[] = [];
        let existingHeightMin = Number.POSITIVE_INFINITY;
        let existingHeightMax = Number.NEGATIVE_INFINITY;

        // Identify an existing height axis by checking its name against known height fields
        for (let i = 0; i < updatedYAxis.length; i++) {
            const axis = updatedYAxis[i];
            if (axis && axis.name) {
                const axisNames = axis.name.split(',').map((n: string) => n.trim());
                if (axisNames.some((n: string) => heightFields.includes(n))) {
                    heightYAxisIndex = i;
                    existingHeightFields = axisNames;
                    // Extract current min/max if numeric
                    if (axis.min !== undefined && typeof axis.min === 'number') {
                        existingHeightMin = axis.min;
                    }
                    if (axis.max !== undefined && typeof axis.max === 'number') {
                        existingHeightMax = axis.max;
                    }
                    break;
                }
            }
        }

        // If we have height series, we need to either update or create a height axis
        if (heightSeriesData.length > 0) {
            let heightMin = Number.POSITIVE_INFINITY;
            let heightMax = Number.NEGATIVE_INFINITY;
            let heightNames: string[] = [];

            heightSeriesData.forEach(d => {
                if (d.min && (d.min < heightMin)) heightMin = d.min;
                if (d.max && (d.max > heightMax)) heightMax = d.max;
                heightNames.push(d.series.name);
            });

            if (heightYAxisIndex !== null) {
                // Update existing height axis
                const allHeightFieldsCombined = Array.from(
                    new Set([...existingHeightFields, ...heightNames])
                );
                const combinedMin = Math.min(existingHeightMin, heightMin);
                const combinedMax = Math.max(existingHeightMax, heightMax);

                updatedYAxis[heightYAxisIndex] = {
                    ...updatedYAxis[heightYAxisIndex],
                    name: allHeightFieldsCombined.join(', '),
                    min: combinedMin,
                    max: combinedMax,
                };
            } else {
                // No existing height axis - create a new one
                heightYAxisIndex = updatedYAxis.length;
                updatedYAxis.push({
                    type: 'value',
                    name: heightNames.join(', '), // Concatenate height-related field names
                    min: heightMin,
                    max: heightMax,
                    scale: true,
                    axisLabel: {
                        formatter: (value: number) => value.toFixed(1),
                    },
                });
            }

            // Assign all height series to the identified (or newly created) height axis
            const mappedHeightSeries = heightSeriesData.map(d => ({
                ...d.series,
                type: 'scatter',
                yAxisIndex: heightYAxisIndex as number,
            }));
            updatedSeries = updatedSeries.concat(mappedHeightSeries);
        }

        // For non-height data, each one gets its own axis as a new axis
        const mappedNonHeightSeries = nonHeightSeriesData.map(d => {
            const nonHeightAxisIndex = updatedYAxis.length;
            updatedYAxis.push({
                type: 'value',
                name: d.series.name,
                min: d.min,
                max: d.max,
                scale: true,
                axisLabel: {
                    formatter: (value: number) => value.toFixed(1),
                },
            });
            return {
                ...d.series,
                type: 'scatter',
                yAxisIndex: nonHeightAxisIndex,
            };
        });
        updatedSeries = updatedSeries.concat(mappedNonHeightSeries);

        // -----------------------------
        //     UPDATE LEGEND
        // -----------------------------
        // 1) Grab existing legend from filteredOptions (could be array or object).
        const existingLegend = filteredOptions.legend;
        let updatedLegend: LegendComponentOption[] = [];

        if (Array.isArray(existingLegend) && existingLegend.length > 0) {
            // If the chart uses an array of legend configs, clone them:
            updatedLegend = existingLegend.map(legendObj => {
                // Convert legendObj.data to an array or fallback to empty array
                const legendData = Array.isArray(legendObj.data) ? [...legendObj.data] : [];

                // Gather all new series names
                const newSeriesNames = updatedSeries
                    .map(s => s.name)
                    .filter(name => !!name && !legendData.includes(name as string));

                const mergedLegendData = legendData.concat(newSeriesNames);
                return {
                    ...legendObj,
                    data: mergedLegendData,
                };
            });
        } else if (existingLegend && !Array.isArray(existingLegend)) {
            // If it's a single legend object
            const legendData = Array.isArray(existingLegend.data)
                ? [...existingLegend.data]
                : [];

            // Gather all new series names
            const newSeriesNames = updatedSeries
                .map(s => s.name)
                .filter(name => !!name && !legendData.includes(name as string));

            const mergedLegendData = legendData.concat(newSeriesNames);
            updatedLegend = [
                {
                    ...existingLegend,
                    data: mergedLegendData,
                },
            ];
        } else {
            // If no legend config exists, create one
            const newSeriesNames = updatedSeries.map(s => s.name).filter(Boolean) as string[];
            updatedLegend = [
                {
                    data: newSeriesNames,
                    left: 'left',
                },
            ];
        }

        // -----------------------------
        //     APPLY UPDATED OPTIONS
        // -----------------------------
        chart.setOption({
            ...filteredOptions,
            legend: updatedLegend,
            series: updatedSeries,
            yAxis: updatedYAxis,
            // If you want to ensure a merge, you can pass a second param:
            // }, { notMerge: false }
        });
        const options = chart.getOption() as EChartsOption;
        //console.log(`initScatterPlotWith ${reqId} AFTER options:`, options);

        //console.log( `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,chart.getOption());
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}
  
export const addOverlaysToScatterPlot = async (msg:string) => {
    const startTime = performance.now();
    //console.log(`addOverlaysToScatterPlot for: ${msg}`);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds();
        //console.log(`addOverlaysToScatterPlot reqIds:`, reqIds);
        reqIds.forEach(async reqId => { 
            if(reqId > 0){
                await updateWhereClauseAndXData(reqId);
                await appendSeries(reqId);
            } else {
                console.error(`addOverlaysToScatterPlot Invalid request ID:${reqId}`);
            }
        });
    } else {
        console.warn(`Ignoring addOverlaysToScatterPlot with no plot to update, plotRef is undefined.`);
    }
    const endTime = performance.now();
    console.log(`addOverlaysToScatterPlot took ${endTime - startTime} milliseconds.`);
}

export const refreshScatterPlot = async (msg:string) => {
    //console.log(`refreshScatterPlot ${msg}`);
    const recTreeStore = useRecTreeStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef){
        if(plotRef.chart) {
            await initScatterPlotWith(recTreeStore.selectedReqId);
            await addOverlaysToScatterPlot(msg);
        } else {
            console.warn(`Ignoring refreshScatterPlot with no chart to refresh, plotRef.chart is undefined.`);
        }
    } else {
        console.warn(`Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined.`);
    }
};

export async function getPhotonOverlayRunContext(): Promise<SrRunContext> {
    const recTreeStore = useRecTreeStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const requestsStore = useRequestsStore();
    const globalChartStore = useGlobalChartStore();
    const reqIdStr = recTreeStore.selectedReqIdStr;
    //console.log('getPhotonOverlayRunContext reqIdStr:', reqIdStr, ' chartStore.stateByReqId:', chartStore.stateByReqId[reqIdStr]);
    const runContext: SrRunContext = {
        reqId: -1, // this will be set in the worker
        parentReqId: recTreeStore.selectedReqId,
        trackFilter: {
            rgt: (globalChartStore.getRgt()>=0) ? globalChartStore.getRgt(): -1,
            cycle: (globalChartStore.getCycles().length === 1) ? globalChartStore.getCycles()[0]: -1,
            track: (globalChartStore.getTracks().length === 1) ? globalChartStore.getTracks()[0]: -1,
            beam: (globalChartStore.getGts().length === 1) ? globalChartStore.getGts()[0]: -1,
        }
    };
    if(atlChartFilterStore.getShowPhotonCloud()){
        //console.log('Show Photon Cloud Overlay checked');
        const reqId = await indexedDb.findCachedRec(runContext);
        if(reqId && (reqId > 0)){ // Use the cached request
            runContext.reqId = reqId;
            console.log('findCachedRec reqId found:', reqId, 'runContext:', runContext);
            atlChartFilterStore.setSelectedOverlayedReqIds([reqId]);
        } else {
            console.warn('findCachedRec reqId not found, NEED to fetch for:', runContext);
            requestsStore.setSvrMsg('');
        }
    }
    return runContext;
}

export async function updatePlotAndSelectedTrackMapLayer(msg:string){
    const startTime = performance.now(); 
    console.log('updatePlotAndSelectedTrackMapLayer called for:',msg);
    const recTreeStore = useRecTreeStore();
    const mission = useFieldNameStore().getMissionForReqId(recTreeStore.selectedReqId);
    const globalChartStore = useGlobalChartStore();
    if( (globalChartStore.getRgt() >= 0) &&
        (globalChartStore.getCycles().length > 0) &&
        (globalChartStore.getSpots().length > 0)
    ){
        //TBD  Can these be done in parallel?
        await refreshScatterPlot(msg);
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const chunkSize = useSrParquetCfgStore().getChunkSizeToRead();
        await duckDbReadAndUpdateSelectedLayer(recTreeStore.selectedReqId,SELECTED_LAYER_NAME_PREFIX,chunkSize,maxNumPnts);       
    } else {
        console.warn('updatePlotAndSelectedTrackMapLayer Need Rgts, Cycles, and Spots values selected');
        console.warn('updatePlotAndSelectedTrackMapLayer Rgt:', globalChartStore.getRgt());
        console.warn('updatePlotAndSelectedTrackMapLayer Cycles:', globalChartStore.getCycles());
        console.warn('updatePlotAndSelectedTrackMapLayer Spots:', globalChartStore.getSpots());
    }

    const endTime = performance.now(); 
    console.log(`updatePlotAndSelectedTrackMapLayer took ${endTime - startTime} milliseconds.`);
}


let updatePlotTimeoutId: number | undefined;
let pendingResolves: Array<() => void> = [];

export async function callPlotUpdateDebounced(msg: string): Promise<void> {
    console.log("callPlotUpdateDebounced called:", msg);
    const atlChartFilterStore = useAtlChartFilterStore();
    atlChartFilterStore.setIsWarning(true);
    atlChartFilterStore.setMessage('Updating...');
  
    // Clear any existing timeout to debounce the calls
    if (updatePlotTimeoutId) {
        clearTimeout(updatePlotTimeoutId);
    }
  
    return new Promise((resolve) => {
        // Store the resolver
        pendingResolves.push(resolve);
        updatePlotTimeoutId = window.setTimeout(async () => {
        await updatePlotAndSelectedTrackMapLayer(msg);
        // Resolve all pending promises, since updatePlotAndSelectedTrackMapLayer is now complete
        pendingResolves.forEach(res => res());
        pendingResolves = [];
        }, 500);
    });
}

export const findReqMenuLabel = (reqId:number) => {
    const recTreeStore = useRecTreeStore();
    const item = recTreeStore.reqIdMenuItems.find(
        (i) => i.value === reqId
    )
    return item ? item.label : 'unknown'
}

export async function initSymbolSize(req_id: number):Promise<number>{
    const reqIdStr = req_id.toString();
    const plotConfig = await indexedDb.getPlotConfig();
    const chartStore = useChartStore();
    const symbolStore = useSymbolStore(); 
    const func = await indexedDb.getFunc(req_id);//must use db
    if (func.includes('atl03sp') || func.includes('atl03x')) {
        //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03spSymbolSize  ?? 1);
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl03spSymbolSize  ?? 1));
    } else if (func.includes('atl03vp')) {
        //symbolStore.size[reqIdStr] = (plotConfig?.defaultAtl03vpSymbolSize  ?? 5);
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl03vpSymbolSize  ?? 5));
    } else {
        symbolStore.setSize(reqIdStr, (plotConfig?.defaultAtl06SymbolSize ?? 3));
    } 
    //console.log('initSymbolSize reqId:', req_id, 'func:', func, 'symbolSize:', chartStore.getSymbolSize(reqIdStr));
    return symbolStore.getSize(reqIdStr); 
}

export async function updateWhereClauseAndXData(req_id: number) {
    //console.log('updateWhereClauseAndXData req_id:', req_id);
    const reqIdStr = req_id.toString();
    if (req_id <= 0) {
        console.warn(`updateWhereClauseAndXData Invalid request ID:${req_id}`);
        return;
    }
    try {
        const reqIdStr = req_id.toString();
        //console.log('updateWhereClauseAndXData req_id:', req_id);
        const func = useRecTreeStore().findApiForReqId(req_id);
        const chartStore = useChartStore();
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        
        const whereClause = createWhereClause(req_id);
        if(whereClause !== ''){
            chartStore.setWhereClause(reqIdStr,whereClause);
        } else {
            console.error('updateWhereClauseAndXData whereClause is empty');
        }
    } catch (error) {
        console.warn('updateWhereClauseAndXData Failed to update selected request:', error);
    }
}
