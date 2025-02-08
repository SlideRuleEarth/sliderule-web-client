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
import { useColorMapStore }  from "@/stores/colorMapStore";
import { getColorForAtl03CnfValue,getColorForAtl08ClassValue } from '@/utils/colorUtils';

export const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
export const yDataSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const yColorEncodeSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const solidColorSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});
export const showYDataMenuReactive = reactive<{ [key: string]: WritableComputedRef<boolean> }>({});
export const selectedCycleReactive = reactive<{ [key: string]: WritableComputedRef<number[]> }>({});
export const selectedSpotReactive = reactive<{ [key: string]: WritableComputedRef<number[]> }>({});
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

export function getDefaultColorEncoding(reqId:number) {
    const func = useRecTreeStore().findApiForReqId(reqId);
    if(func.includes('atl03sp')) {
        return 'atl03_cnf';
    } else if(func.includes('atl03vp')) {
        return 'segment_ph_cnt';
    } else if(func.includes('atl08')) {
        return 'h_mean_canopy';
    } else if(func.includes('atl06sp')) {
        return 'h_li';
    } else if(func.includes('atl06')) {
        return 'h_mean';
    } else {
        return 'solid';
    }
}

export function initializeColorEncoding(reqId:number){
    const reqIdStr = reqId.toString();
    const chartStore = useChartStore();
    chartStore.setSelectedColorEncodeData(reqIdStr, getDefaultColorEncoding(reqId));
    //console.log(`initializeColorEncoding ${reqIdStr} chartStore.getSelectedColorEncodeData:`, chartStore.getSelectedColorEncodeData(reqIdStr));
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
        if (!(reqId in selectedCycleReactive)) {
            selectedCycleReactive[reqId] = computed({
                get: (): number[] => {
                    const value = globalChartStore.getCycles();
                    //console.log(`selectedCycleReactive[${reqId}] get:`, value);
                    return value;
                },
                set: (values: number[]): void => {
                    //console.log(`selectedCycleReactive[${reqId}] set:`, values);
                    globalChartStore.setCycles(values);
                },
            });
        }
        if (!(reqId in selectedSpotReactive)) {
            selectedSpotReactive[reqId] = computed({
                get: (): number[] => {
                    const value = globalChartStore.getSpots();
                    //console.log(`selectedSpotReactive[${reqId}] get:`, value);
                    return value;
                },
                set: (values: number[]): void => {
                    //console.log(`selectedSpotReactive[${reqId}] set:`, values);
                    globalChartStore.setSpots(values);
                },
            });
        }       

    });
}


function createDiscreteColorFunction(
    getColorFunction: (value: number) => string,
    ndx_name:string
) 
{
    const colorCache: Record<number, string> = {};
    let ndx:number = -1;
    return (params:any) => {
        //console.log('createDiscreteColorFunction1 ndx:',ndx,' params:',params);
        if(ndx<0){
            ndx = useColorMapStore().getDataOrderNdx[ndx_name]
        }
        const value = params.data[ndx];
        if (colorCache[value] === undefined) {
            colorCache[value] = getColorFunction(value);
        }
        return colorCache[value];
    };
}



const getAtl03CnfColorCached = createDiscreteColorFunction(
    getColorForAtl03CnfValue,
    'atl03_cnf'
);




const getAtl08ClassColorCached = createDiscreteColorFunction(
    getColorForAtl08ClassValue,
    'atl08_class'
);

//const getColorUsingGradient = colorMapStore.createGradientColorFunction('yapc_score',0,255);

function getColorUsingAtl03_cnf(params: any): string {
    return getAtl03CnfColorCached(params);
}


function getColorUsingAtl08_class(params: any): string {
    return getAtl08ClassColorCached(params);
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
        minMaxValues: Record<string, { min: number; max: number }>;
        normalizedMinMaxValues: Record<string, { min: number; max: number }>;
        dataOrderNdx: Record<string, number>;
    }>;
    // The property name for minMax or normalizedMinMax
    minMaxProperty: 'minMaxValues' | 'normalizedMinMaxValues';
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
        //console.log(`${functionName}: chartData:`, chartData);
        // e.g. choose minMax based on minMaxProperty
        const minMaxValues = rest[minMaxProperty] || {};
        //console.log(`${functionName}: minMaxValues:`, minMaxValues);
        const chartStore = useChartStore();
        chartStore.setMinMaxValues(reqIdStr, minMaxValues);
        chartStore.setDataOrderNdx(reqIdStr, rest['dataOrderNdx'] || {});
        const colorMapStore = useColorMapStore();
        colorMapStore.setDataOrderNdx(rest['dataOrderNdx'] || {});
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn(`${functionName}: chartData or minMax is empty, skipping processing.`);
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
                const minValue = chartStore.getMinValue(reqIdStr, cedk);
                const maxValue = chartStore.getMaxValue(reqIdStr, cedk);
                thisColorFunction = colorMapStore.createGradientColorFunction(cedk,minValue,maxValue);
            }
            colorFunction = thisColorFunction;
        }
        //console.log(`${functionName}: colorFunction:`, colorFunction);
        // Get the selected Y data name
        const ySelectedName = chartStore.getSelectedYData(reqIdStr);

        if (y.includes(ySelectedName)) {
            const yIndex =  useColorMapStore().getDataOrderNdx[ySelectedName];
            const data = chartData[reqIdStr].data; // get raw number[][] data
            const min = minMaxValues[ySelectedName]?.min ?? null;
            const max = minMaxValues[ySelectedName]?.max ?? null;
            //console.log(`${functionName}: Index of selected Y data "${ySelectedName}" in Y array is ${yIndex}. Min: ${min}, Max: ${max}`, data);

            yItems.push({
                series: {
                    name: ySelectedName,
                    type: 'scatter',
                    data: data,
                    dimensions:[...useColorMapStore().getDimensions], 
                    encode: { x: 0, y: yIndex },
                    itemStyle: { color: colorFunction },
                    z: zValue,
                    large: useAtlChartFilterStore().getLargeData(),
                    largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                    progressive: progressiveChunkSize,
                    progressiveThreshold,
                    progressiveChunkMode,
                    animation: false,
                    yAxisIndex: 0, // only plotting on series i.e. y-axis 0
                    symbolSize: chartStore.getSymbolSize(reqIdStr),
                },
                min,
                max,
            });

            const totalPoints = data.length;
            chartStore.setNumOfPlottedPnts(reqIdStr, totalPoints);
        } else {
            console.warn(`${functionName}: selected Y data "${ySelectedName}" not found in provided Y array.`);
        }
    } catch (error) {
        console.error(`${functionName} Error:`, error);
    } finally {
        const endTime = performance.now();
        console.log(`${functionName} took ${endTime - startTime} milliseconds.`);
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
        transformRow: (row, xCol, yCols, minMaxValues,dataOrderNdx,orderNdx) => {
            // figure out the offset for X
            const segMin = minMaxValues['segment_dist']?.min || 0;
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
        thisColorFunction = getColorUsingAtl03_cnf;
    } else if(cedk === 'atl08_class'){
        thisColorFunction = getColorUsingAtl08_class;
    }


    return getGenericSeries({
        reqIdStr,
        fileName,
        x,
        y,
        fetchOptions,             // pass the specialized logic above
        fetchData: fetchScatterData,
        minMaxProperty: 'minMaxValues', // read from minMaxValues rather than normalizedMinMaxValues
        colorFunction: thisColorFunction, 
        zValue: 0,
        functionName: 'getSeriesForAtl03sp', // for the log
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
    minMaxProperty: 'minMaxValues', // note the difference
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
    minMaxProperty: 'normalizedMinMaxValues', // note the difference
    zValue: 10,                               // z value for ATL06
    functionName: 'getSeriesForAtl08',
});
}

export function clearPlot() {
    const atlChartFilterStore = useAtlChartFilterStore();
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef) {
        if(plotRef.chart){
            plotRef.chart.clear();
            //console.log('clearPlot: plotRef.chart cleared');
        } else {
            console.warn('clearPlot: plotRef.chart is undefined');
        }
    } else {
        console.warn('clearPlot: plotRef is undefined');
    }
}

const formatTooltip = (params: any) => {
    //console.log('formatTooltip params:', params );
    const paramsData = params.data;
    const paramsDim = params.dimensionNames as any[];
    let ndx = 0;
    return paramsDim.map((dim: any) => `${dim}: ${paramsData[ndx++]}`).join('<br>');
};

async function getSeriesFor(reqIdStr:string) : Promise<SrScatterSeriesData[]>{
    const chartStore = useChartStore();
    const startTime = performance.now(); // Start time
    const fileName = chartStore.getFile(reqIdStr);
    const reqId = Number(reqIdStr);
    const func = useRecTreeStore().findApiForReqId(reqId);
    const x = chartStore.getXDataForChart(reqIdStr);
    const y = chartStore.getYDataOptions(reqIdStr);
    let seriesData = [] as SrScatterSeriesData[];
    try{
        if(fileName){
            if(func==='atl03sp'){
                seriesData = await getSeriesForAtl03sp(reqIdStr, fileName, x, y);
            } else if(func==='atl03vp'){
                seriesData = await getSeriesForAtl03vp(reqIdStr, fileName, x, y);
            } else if(func.includes('atl06')){
                seriesData = await getSeriesForAtl06(reqIdStr, fileName, x, y);
            } else if(func.includes('atl08')){
                seriesData = await getSeriesForAtl08(reqIdStr, fileName, x, y);
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
        const endTime = performance.now(); // End time
        console.log(`getSeriesFor ${reqIdStr} fileName:${fileName} took ${endTime - startTime} milliseconds. seriesData.length:`, seriesData.length);
        //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
    }
    return seriesData;
}

export async function initChartStore() {
    const startTime = performance.now(); // Start time
    const recTreeStore = useRecTreeStore();
    const chartStore = useChartStore();
    for (const reqIdItem of recTreeStore.reqIdMenuItems) {
        const reqIdStr = reqIdItem.value.toString();
        const reqId = Number(reqIdItem.value);

        if (reqId <= 0) {
            console.warn('Invalid request ID:', reqId);
            continue;
        }

        try {

            initSymbolSize(reqId);
            initializeColorEncoding(reqId);
            const request = await indexedDb.getRequest(reqId);

            if (!request) {
                console.error(`No request found for reqId: ${reqIdStr}`, request);
                continue;
            }

            const { file, func, description, num_bytes, cnt } = request;

            if (file) {
                chartStore.setFile(reqIdStr, file);
            } else {
                console.error(`No file found for reqId: ${reqIdStr}`, request);
            }

            if (description) {
                chartStore.setDescription(reqIdStr, description);
            } // No warning needed for missing description.

            if (num_bytes) {
                chartStore.setSize(reqIdStr, num_bytes);
            } else {
                if(num_bytes===undefined){
                    console.error(`No num_bytes found for reqId: ${reqIdStr}`, request);
                }
            }

            if (cnt) {
                chartStore.setRecCnt(reqIdStr, cnt);
            } else {
                if(cnt===undefined){
                    console.error(`No cnt found for reqId: ${reqIdStr}`, request);
                }
            }
        } catch (error) {
            console.error(`Error processing reqId: ${reqIdStr}`, error);
        }
    }
    const endTime = performance.now(); // End time
    console.log(`initChartStore took ${endTime - startTime} milliseconds.`);
}


export async function getScatterOptions(req_id:number): Promise<any> {
    const chartStore = useChartStore();
    const globalChartStore = useGlobalChartStore();
    const startTime = performance.now(); // Start time
    const reqIdStr = req_id.toString();
    const fileName = chartStore.getFile(reqIdStr);
    const y = chartStore.getYDataOptions(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const rgt = globalChartStore.getRgt();
    const cycles = useGlobalChartStore().getCycles();
    const spots = globalChartStore.getSpots();
    // Get the CSS variable value dynamically
    const primaryButtonColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--p-button-text-primary-color')
        .trim(); // Retrieve and trim the color value

    let options = null;
    try{
        let seriesData = [] as SrScatterSeriesData[];
        if(fileName){
            if(spots.length>0 && rgt>=0 && cycles.length>0){
                seriesData = await getSeriesFor(reqIdStr);
            } else {
                console.warn('getScatterOptions Filter not set i.e. spots, rgts, or cycles is empty');
            }
        }
        if(seriesData.length !== 0){
            options = {
                title: {
                    text: `Highlighted Track`,
                    left: "center"
                },
                tooltip: {
                    trigger: "item",
                    formatter: (params: any) => formatTooltip(params),
                },
                legend: {
                    data: seriesData.map(series => series.series.name),
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
                    }
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
                        filterMode: 'none',
                        bottom: 1,
                    },
                    {
                        type: 'slider', // This creates a slider to zoom in the Y-axis
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0, // Adjusting for multiple y-axes if necessary
                        filterMode: 'none',
                        left: '95%',
                        width: 20,
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        xAxisIndex: 0,
                        filterMode: 'none',
                    },
                    {
                        type: 'inside', // This allows zooming inside the chart using mouse wheel or touch gestures
                        yAxisIndex: seriesData.length > 1 ? [0, 1] : 0,
                        filterMode: 'none',
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
        const endTime = performance.now(); // End time
        console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`,options);
        return options;
    }
}

export async function getScatterOptionsFor(reqId:number) {
    const atlChartFilterStore = useAtlChartFilterStore();
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
            //const options = plotRef.chart.getOption();
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
    delete options.toolbox;
    delete options.visualMap;
    delete options.timeline;
    delete options.calendar;
    return options;
}

async function appendSeries(reqId: number): Promise<void> {
    try {
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
        //console.log(`appendSeries(${reqIdStr}): existing filteredOptions:`, filteredOptions);
        // Fetch series data for the given reqIdStr
        const seriesData = await getSeriesFor(reqIdStr);
        if (!seriesData.length) {
            console.warn(`appendSeries(${reqIdStr}): No series data found.`);
            return;
        }

        // Define the fields that should share a single axis
        const heightFields = ['height', 'h_mean', 'h_mean_canopy'];

        // Separate series into "height" group and "non-height" group
        const heightSeriesData = seriesData.filter(d => heightFields.includes(d.series.name));
        const nonHeightSeriesData = seriesData.filter(d => !heightFields.includes(d.series.name));

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

        //console.log( `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,chart.getOption());
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}
  
const updateScatterPlot = async (msg:string) => {
    const startTime = performance.now();
    //console.log(`updateScatterPlot for: ${msg}`);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds();
        //console.log(`updateScatterPlot reqIds:`, reqIds);
        reqIds.forEach(async reqId => { 
            if(reqId > 0){
                await updateWhereClauseAndXData(reqId);
                await appendSeries(reqId);
            } else {
                console.error(`updateScatterPlot Invalid request ID:${reqId}`);
            }
        });
    } else {
        console.warn(`Ignoring updateScatterPlot with no plot to update, plotRef is undefined.`);
    }
    const endTime = performance.now();
    console.log(`updateScatterPlot took ${endTime - startTime} milliseconds.`);
}

const refreshScatterPlot = async (msg:string) => {
    //console.log(`refreshScatterPlot ${msg}`);
    const recTreeStore = useRecTreeStore();
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        clearPlot();
        await initScatterPlotWith(recTreeStore.selectedReqId);
        await updateScatterPlot(msg);
    } else {
        console.error(`Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined.`);
    }
};

export const updateScatterOptionsOnly = async (msg:string) => {
    //console.log(`updateScatterOptionsOnly ${msg}`);
    const recTreeStore = useRecTreeStore();
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        clearPlot();
        await getScatterOptionsFor(recTreeStore.selectedReqId);
        await updateScatterPlot(msg);
    } else {
        console.error(`Ignoring updateScatterOptionsOnly with no plot to update, plotRef is undefined.`);
    }
}

export async function getPhotonOverlayRunContext(pendingCycle:number): Promise<SrRunContext> {
    const recTreeStore = useRecTreeStore();
    const globalChartStore = useGlobalChartStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const requestsStore = useRequestsStore();

    const reqIdStr = recTreeStore.selectedReqIdStr;
    //console.log('getPhotonOverlayRunContext reqIdStr:', reqIdStr, ' chartStore.stateByReqId:', chartStore.stateByReqId[reqIdStr]);
    const runContext: SrRunContext = {
        reqId: -1, // this will be set in the worker
        parentReqId: recTreeStore.selectedReqId,
        trackFilter: {
            rgt: globalChartStore.getRgt(),
            cycle: pendingCycle,
            // : globalChartStore.getTracks(),
        }
    };
    if(atlChartFilterStore.getShowPhotonCloud()){
        //console.log('Show Photon Cloud Overlay checked');
        const reqId = await indexedDb.findCachedRec(runContext);
        if(reqId && (reqId > 0)){ // Use the cached request
            runContext.reqId = reqId;
        } else {
            console.warn('findCachedRec reqId not found, NEED to fetch for:', runContext);
            requestsStore.setSvrMsg('');
        }
    }
    return runContext;
}

async function updatePlot(msg:string){
    console.log('updatePlot called for:',msg);
    const recTreeStore = useRecTreeStore();
    const globalChartStore = useGlobalChartStore();
    if( (globalChartStore.getRgt() >= 0) &&
        (useGlobalChartStore().getCycles().length > 0) &&
        (globalChartStore.getSpots().length > 0)
    ){
        await refreshScatterPlot(msg);
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const chunkSize = useSrParquetCfgStore().getChunkSizeToRead();
        await duckDbReadAndUpdateSelectedLayer(recTreeStore.selectedReqId,chunkSize,maxNumPnts);
    } else {
        console.warn('Need Rgt, Cycle, and Spot values selected');
        console.warn('Rgt:', globalChartStore.getRgt());
        console.warn('Cycle:', useGlobalChartStore().getCycles());
        console.warn('Spot:', globalChartStore.getSpots());
    }
}
let updatePlotTimeoutId: number | undefined;
let pendingResolves: Array<() => void> = [];


export async function callPlotUpdateDebounced(msg: string): Promise<void> {
    console.log("callPlotUpdateDebounced called for:", msg);
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
        await updatePlot(msg);
        
        // Resolve all pending promises, since updatePlot is now complete
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
    const func = await indexedDb.getFunc(req_id);//must use db
    if (func.includes('atl03sp')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl03spSymbolSize  ?? 1));
    } else if (func.includes('atl03vp')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl03vpSymbolSize  ?? 5));
    } else if (func.includes('atl06')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl06SymbolSize  ?? 3));
    } else if (func.includes('atl08')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl08SymbolSize  ?? 3));
    } else {
        console.error('initSymbolSize unknown function:', func,' for reqId:', req_id);
    }
    //console.log('initSymbolSize reqId:', req_id, 'func:', func, 'symbolSize:', chartStore.getSymbolSize(reqIdStr));
    return chartStore.getSymbolSize(reqIdStr);
}

export async function updateWhereClauseAndXData(req_id: number) {
    console.log('updateWhereClauseAndXData req_id:', req_id);
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
        const globalChartStore = useGlobalChartStore();
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        
        const whereClause = createWhereClause(
            useRecTreeStore().findApiForReqId(req_id),
            globalChartStore.getSpots(),
            globalChartStore.getRgt(),
            useGlobalChartStore().getCycles(),
        );
        if(whereClause !== ''){
            chartStore.setWhereClause(reqIdStr,whereClause);
        } else {
            console.error('updateWhereClauseAndXData whereClause is empty');
        }
    } catch (error) {
        console.warn('updateWhereClauseAndXData Failed to update selected request:', error);
    }
}
