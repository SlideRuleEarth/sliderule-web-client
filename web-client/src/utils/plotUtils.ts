import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { useAtl03ColorMapStore }  from "@/stores/atl03ColorMapStore";
import { fetchAtl03spScatterData, fetchAtl03vpScatterData, fetchAtl06ScatterData, fetchAtl08ScatterData } from "@/utils/SrDuckDbUtils";
import type { EChartsOption, LegendComponentOption, ScatterSeriesOption, EChartsType } from 'echarts';
import { createWhereClause } from "./spotUtils";
import type { ECharts } from 'echarts/core';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { duckDbReadAndUpdateSelectedLayer } from '@/utils/SrDuckDbUtils';
import {type  SrRunContext } from '@/db/SlideRuleDb';
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { useRequestsStore } from "@/stores/requestsStore";
import type { WritableComputedRef } from "vue";
import { reactive, computed } from 'vue';


const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();
const requestsStore = useRequestsStore();
export const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
export const yDataSelectedReactive = reactive<{ [key: string]: WritableComputedRef<string> }>({});

export interface SrScatterSeriesData{
  series: {
      name: string;
      type: string;
      data: number[][];
      large: boolean;
      largeThreshold: number;
      animation: boolean;
      yAxisIndex: number;
      symbolSize?: number;
  };
  min: number;
  max: number;
};

export function initDataBindingsToChartStore(reqIds: string[]) {
    //console.log('initDataBindingsToChartStore:', reqIds);
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
    });
}

let debugCnt = 10;
function getAtl03spColor(params: any):string {
    if(debugCnt++ < 10){
        //console.log('getAtl03spColor Atl03ColorKey:', useAtl03ColorMapStore().getAtl03ColorKey());
        //console.log('getAtl03spColor params.data:', params.data);
    }
    let colorStr = 'red';
    let value = -1;
    if(useAtl03ColorMapStore().getAtl03ColorKey() === 'atl03_cnf'){ 
        value = params.data[2];
        colorStr = useAtl03ColorMapStore().getColorForAtl03CnfValue(value);
    } else if(useAtl03ColorMapStore().getAtl03ColorKey() === 'atl08_class'){
        value = params.data[3];
        colorStr = useAtl03ColorMapStore().getColorForAtl08ClassValue(value);
    } else if(useAtl03ColorMapStore().getAtl03ColorKey() === 'YAPC'){ 
        value = params.data[4];
        const color = useAtl03ColorMapStore().getYapcColorForValue(value,0,255);
        colorStr = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    }
    if(debugCnt++ < 10){
        //console.log(`getAtl03spColor cnt:${debugCnt} value:${value} colorStr:${colorStr}`);
    }
    return colorStr;
}


async function getSeriesForAtl03sp(
    reqIdStr:string, 
    fileName: string, 
    x: string, 
    y: string[]
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y,' symbolSize:',chartStore.getSymbolSize(reqIdStr));
    const startTime = performance.now(); // Start time
    let yItems = [] as SrScatterSeriesData[];
    const plotConfig = await indexedDb.getPlotConfig();
    const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
    const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
    const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';
    try {
        const name = 'atl03sp';
        const { chartData = {}, minMaxValues = {} } = await fetchAtl03spScatterData(reqIdStr,fileName, x, y);
        //console.log('getSeriesForAtl03sp chartData:', chartData, ' minMaxValues:', minMaxValues);
        // Check if either chartData or minMaxValues is empty
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn('getSeriesForAtl03sp chartData or minMaxValues is empty, skipping processing. chartData len:', Object.keys(chartData).length , ' minMaxValues len:', Object.keys(minMaxValues).length);
            return yItems; // Return empty array if either is empty
        }

        yItems = y.map(yName => {
            const data = chartData[yName] ? chartData[yName].map(item => item.value) : [];
            const min = minMaxValues[yName]?.min ?? null; // Default to null if minMaxValues[yName] or min is undefined
            const max = minMaxValues[yName]?.max ?? null; // Default to null if minMaxValues[yName] or max is undefined

            return {
                series: {
                    name: yName,
                    type: 'scatter',
                    data: data,
                    encode: {
                        x: 0,
                        y: 1
                    },
                    z: 0,
                    itemStyle: {
                        color: getAtl03spColor,
                    },
                    large: useAtlChartFilterStore().getLargeData(),
                    largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                    progressive: progressiveChunkSize,
                    progressiveThreshold: progressiveThreshold,
                    progressiveChunkMode: progressiveChunkMode,
                    animation: false,
                    yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                    symbolSize: chartStore.getSymbolSize(reqIdStr),
                },
                min: min,
                max: max
            };
        });
        // Log the total number of points across all series
        const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
        chartStore.setNumOfPlottedPnts(reqIdStr,totalPoints)
        //console.log(`Total number of points across all series: ${totalPoints}`);

    } catch (error) {
        console.error('getSeriesForAtl03sp Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesForAtl03sp took ${endTime - startTime} milliseconds.`);
    }
    //console.log('getSeriesForAtl03sp yItems:', yItems);
    return yItems;
}


async function getSeriesForAtl03vp(
    reqIdStr:string, 
    fileName: string, 
    x: string, 
    y: string[]
): Promise<SrScatterSeriesData[]> {
//console.log('getSeriesForAtl03vp fileName:', fileName, ' x:', x, ' y:', y);
const startTime = performance.now(); // Start time
let yItems = [] as SrScatterSeriesData[];
const plotConfig = await indexedDb.getPlotConfig();
const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';
try {
    const name = 'atl03vp';
    const { chartData = {}, normalizedMinMaxValues = {} } = await fetchAtl03vpScatterData(reqIdStr,fileName, x, y);
    //console.log('getSeriesForAtl03vp chartData:', chartData);
    //console.log('getSeriesForAtl03vp minMaxValues:', normalizedMinMaxValues);

    // Check if either chartData or normalizedMinMaxValues is empty
    if (Object.keys(chartData).length === 0 || Object.keys(normalizedMinMaxValues).length === 0) {
        console.warn('getSeriesForAtl03vp chartData or minMaxValues is empty, skipping processing.');
        return yItems; // Return empty array if either is empty
    }

    yItems = y.map(yName => {
        const data = chartData[yName] ? chartData[yName].map(item => item.value) : [];
        const min = normalizedMinMaxValues[yName]?.min ?? null; // Default to null if minMaxValues[yName] or min is undefined
        const max = normalizedMinMaxValues[yName]?.max ?? null; // Default to null if minMaxValues[yName] or max is undefined
        //console.log('getSeriesForAtl03vp data:', data);
        //console.log('getSeriesForAtl03vp min:', min, ' max:', max);
        return {
            series: {
                name: yName,
                type: 'scatter',
                data: data,
                encode: {
                    x: 0,
                    y: 1
                },
                large: useAtlChartFilterStore().getLargeData(),
                largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                progressive: progressiveChunkSize,
                progressiveThreshold: progressiveThreshold,
                progressiveChunkMode: progressiveChunkMode,
                animation: false,
                yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                symbolSize: chartStore.getSymbolSize(reqIdStr),
            },
            min: min,
            max: max
        };
    });
    // Log the total number of points across all series
    const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
    chartStore.setNumOfPlottedPnts(reqIdStr,totalPoints)
    //console.log(`Total number of points across all series: ${totalPoints}`);

} catch (error) {
    console.error('getSeriesForAtl03vp Error:', error);
} finally {
    const endTime = performance.now(); // End time
    console.log(`getSeriesForAtl03vp took ${endTime - startTime} milliseconds.`);
}

return yItems;
}


async function getSeriesForAtl06(
  reqIdStr:string, 
  fileName: string, 
  x: string, 
  y: string[]
): Promise<SrScatterSeriesData[]> {
  //console.log('getSeriesForAtl06 fileName:', fileName, ' x:', x, ' y:', y, ' spots:', spots, ' rgt:', rgt, ' cycle:', cycle);
  const startTime = performance.now();
  let yItems=[] as SrScatterSeriesData[];
  const plotConfig = await indexedDb.getPlotConfig();
  const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
  const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
  const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';
  try{
      const name = 'atl06';
      const { chartData = {} , normalizedMinMaxValues = {} } = await fetchAtl06ScatterData(reqIdStr,fileName, x, y);
      //console.log('getSeriesForAtl06 chartData:', chartData);
      //console.log('getSeriesForAtl06 minMaxValues:', normalizedMinMaxValues);
      // Check if either chartData or minMaxValues is empty
      if (Object.keys(chartData).length === 0 || Object.keys(normalizedMinMaxValues).length === 0) {
          console.warn('getSeriesForAtl06 chartData or minMaxValues is empty, skipping processing.');
          return yItems; // Return empty array if either is empty
      }
      yItems = y.map(yName => {
          const data = chartData[yName] ? chartData[yName].map(item => item.value) : [];
          const min = normalizedMinMaxValues[yName]?.min ?? null; // Default to null if minMaxValues[yName] or min is undefined
          const max = normalizedMinMaxValues[yName]?.max ?? null; // Default to null if minMaxValues[yName] or max is undefined
          //console.log('getSeriesForAtl06 data:', data);
          //console.log('getSeriesForAtl06 min:', min, ' max:', max);
          return {
              series: {
                name: yName,
                type: 'scatter',
                data: data,
                encode: {
                    x: 0,
                    y: 1
                },
                itemStyle: {
                    color: chartStore.getSolidSymbolColor(reqIdStr), 
                },
                z:10,
                large: useAtlChartFilterStore().getLargeData(),
                largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                progressive: progressiveChunkSize,
                progressiveThreshold: progressiveThreshold,
                progressiveChunkMode: progressiveChunkMode,
                animation: false,
                yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                symbolSize: chartStore.getSymbolSize(reqIdStr),
              },
              min: min,
              max: max
          };
      });
      const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
      chartStore.setNumOfPlottedPnts(reqIdStr,totalPoints)
      //console.log(`Total number of points across all series: ${totalPoints}`);
  } catch (error) {
      console.error('getSeriesForAtl06 Error:', error);
  } finally {
      const endTime = performance.now(); // End time
      console.log(`getSeriesForAtl06 took ${endTime - startTime} milliseconds.`);
  }
  //console.log('getSeriesForAtl06 yItems:', yItems);
  return yItems;
}

async function getSeriesForAtl08(
    reqIdStr:string, 
    fileName: string, 
    x: string, 
    y: string[]
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl08 fileName:', fileName, ' x:', x, ' y:', y);
    const startTime = performance.now();
    let yItems=[] as SrScatterSeriesData[];
    const plotConfig = await indexedDb.getPlotConfig();
    const progressiveChunkSize = plotConfig?.progressiveChunkSize ?? 12000;
    const progressiveThreshold = plotConfig?.progressiveChunkThreshold ?? 10000;
    const progressiveChunkMode = plotConfig?.progressiveChunkMode ?? 'sequential';
    try{
        const name = 'atl08';
        const { chartData={}, normalizedMinMaxValues={} } = await fetchAtl08ScatterData(reqIdStr,fileName, x, y);
        //console.log('getSeriesForAtl08 chartData:', chartData, ' minMaxValues:', normalizedMinMaxValues);
        if (Object.keys(chartData).length === 0 || Object.keys(normalizedMinMaxValues).length === 0) {
            console.warn('getSeriesForAtl08 chartData or minMaxValues is empty, skipping processing.');
        } else {
            yItems = y.map(yName => ({
                name: yName,
                type: 'scatter',
                data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
                encode: {
                    x: 0,
                    y: 1
                },
                large: useAtlChartFilterStore().getLargeData(),
                largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                progressive: progressiveChunkSize,
                progressiveThreshold: progressiveThreshold,
                progressiveChunkMode: progressiveChunkMode,
                animation: false,
                yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                symbolSize: chartStore.getSymbolSize(reqIdStr),
            })).map((series, index) => ({
                series,
                min: normalizedMinMaxValues[y[index]].min,
                max: normalizedMinMaxValues[y[index]].max
            }));
        }
        const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
        chartStore.setNumOfPlottedPnts(reqIdStr,totalPoints)
        //console.log(`getSeriesForAtl08 Total number of points across all series: ${totalPoints}`);
        return yItems; // Return empty array if either is empty
    } catch (error) {
        console.error('getSeriesForAtl08 getSeriesForAtl08 Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesForAtl08 took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}

export function clearPlot() {
    const plotRef = atlChartFilterStore.getPlotRef();
    if (plotRef) {
      if(plotRef.chart){
        plotRef.chart.clear();
        //console.log('plotRef.chart cleared');
      } else {
        console.warn('plotRef.chart is undefined');
      }
    } else {
      console.warn('plotRef is undefined');
    }
}

const formatTooltip = (params: any, func: string) => {
    if (func === 'atl03sp') {
        const [x, y, atl03_cnf, atl08_class, yapc_score] = params.value;
        return `x: ${x}<br>y: ${y}<br>atl03_cnf: ${atl03_cnf}<br>atl08_class: ${atl08_class}<br>yapc_score: ${yapc_score}`;
    } else {
        const [x, y, x_actual] = params.value;
        return `x: ${x}<br>y: ${y} <br>x_actual: ${x_actual}`;
    }
};

async function getSeriesFor(reqIdStr:string) : Promise<SrScatterSeriesData[]>{
    const startTime = performance.now(); // Start time
    const fileName = chartStore.getFile(reqIdStr);
    const func = chartStore.getFunc(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const y = [chartStore.getSelectedYData(reqIdStr)];
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
    }
    return seriesData;
}

export async function initChartStore(){
    for (const reqIdItem of atlChartFilterStore.reqIdMenuItems) {
        const reqIdStr = reqIdItem.value.toString();
        const thisReqId = Number(reqIdItem.value);
        if(thisReqId > 0) {
            try{
                const request = await indexedDb.getRequest(thisReqId);
                if(request &&request.file){
                    chartStore.setFile(reqIdStr,request.file);
                } else {
                    console.error('No file found for reqId:',reqIdStr);
                }
                if(request && request.func){
                    await chartStore.setFunc(reqIdStr,request.func);
                } else {
                    console.error('No func found for reqId:',reqIdStr);
                }
                if(request && request.description){
                    chartStore.setDescription(reqIdStr,request.description);
                } else {
                    // this is not an error, just a warning
                    //console.warn('No description found for reqId:',reqIdStr);
                }
                if(request && request.num_bytes){
                    useChartStore().setSize(reqIdStr,request.num_bytes);
                } else {
                    console.error('No num_bytes found for reqId:',reqIdStr);
                }
                if(request && request.cnt){
                    useChartStore().setRecCnt(reqIdStr,request.cnt);
                } else {
                    console.error('No num_points found for reqId:',reqIdStr, ' request:', request);
                }
            } catch (error) {
                console.error(`Error in load menu items with reqId: ${reqIdStr}`, error);
            }
        } else {
            console.warn('Invalid request ID:', thisReqId);
        }
    }
}


export async function getScatterOptions(req_id:number): Promise<any> {
    const startTime = performance.now(); // Start time
    const reqIdStr = req_id.toString();
    const fileName = chartStore.getFile(reqIdStr);
    const func = chartStore.getFunc(reqIdStr);
    const y = chartStore.getYDataOptions(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const rgts = chartStore.getRgts(reqIdStr).map(rgt => rgt?.value).filter(value => value !== undefined);
    const cycles = chartStore.getCycles(reqIdStr).map(cycle => cycle?.value).filter(value => value !== undefined);
    const spots = chartStore.getSpots(reqIdStr).map(spot => spot.value);
    let options = null;
    try{
        let seriesData = [] as SrScatterSeriesData[];
        if(fileName){
            if(spots?.length && rgts && cycles){
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
                    formatter: (params: any) => formatTooltip(params, func),
                },
                legend: {
                    data: seriesData.map(series => series.series.name),
                    left: 'left'
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
        console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`);
        return options;
    }
}

export async function getScatterOptionsFor(reqId:number) {
    //let newScatterOptions: EChartsOption = {}; // Initialize a container for the merged options.
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
            console.error(`initScatterPlotWith ${reqId} plotRef.chart is undefined`);
        }
    } else {
        console.warn(`initScatterPlotWith No valid options to apply to chart`);
    }
}

const initScatterPlotWith = async (reqId: number) => {
    const startTime = performance.now();
    console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

    if (reqId === undefined || reqId <= 0) {
        console.error(`initScatterPlotWith ${reqId} reqId is empty or invalid`);
        return;
    }
    await updateChartStore(reqId);

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
        console.log(`appendSeries(${reqIdStr}): existing filteredOptions:`, filteredOptions);
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
                if (d.min < heightMin) heightMin = d.min;
                if (d.max > heightMax) heightMax = d.max;
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

        console.log(
        `appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis + legend.`,
        chart.getOption()
        );
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}
  
const updateScatterPlot = async (msg:string) => {
    const startTime = performance.now();
    console.log(`updateScatterPlot for: ${msg}`);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds();
        console.log(`updateScatterPlot reqIds:`, reqIds);
        reqIds.forEach(async reqId => { 
            if(reqId > 0){
                await updateChartStore(reqId);
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
    console.log(`refreshScatterPlot ${msg}`);
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        clearPlot();
        await initScatterPlotWith(useAtlChartFilterStore().getReqId());
        await updateScatterPlot(msg);
    } else {
        console.warn(`Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined.`);
    }
};

export const updateScatterOptionsOnly = async (msg:string) => {
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        clearPlot();
        await getScatterOptionsFor(useAtlChartFilterStore().getReqId());
        await updateScatterPlot(msg);
    } else {
        console.warn(`Ignoring updateScatterOptionsOnly with no plot to update, plotRef is undefined.`);
    }
}

export async function getPhotonOverlayRunContext(): Promise<SrRunContext> {
    const reqIdStr = atlChartFilterStore.getReqId().toString();
    const runContext: SrRunContext = {
        reqId: -1, // this will be set in the worker
        parentReqId: atlChartFilterStore.getReqId(),
        trackFilter: {
            rgt: chartStore.getRgts(reqIdStr)[0].value,
            cycle: chartStore.getCycles(reqIdStr)[0].value,
            track: chartStore.getTracks(reqIdStr)[0].value,
            beam: chartStore.getBeams(reqIdStr)[0].value
        }
    };
    if(atlChartFilterStore.getShowPhotonCloud()){
        console.log('Show Photon Cloud Overlay checked');
        const reqId = await indexedDb.findCachedRec(runContext);
        if(reqId && (reqId > 0)){
            runContext.reqId = reqId;
            const childReqIdStr = reqId.toString();
            chartStore.setRgts(childReqIdStr,chartStore.getRgts(reqIdStr));
            chartStore.setCycles(childReqIdStr,chartStore.getCycles(reqIdStr));
            chartStore.setTracks(childReqIdStr,chartStore.getTracks(reqIdStr));
            chartStore.setBeams(childReqIdStr,chartStore.getBeams(reqIdStr));
            atlChartFilterStore.setSelectedOverlayedReqIds([reqId]);
            console.log('findCachedRec reqId found:', reqId);
        } else {
            console.warn('findCachedRec reqId not found, NEED to fetch for:', runContext);
            requestsStore.setSvrMsg('');
        }
    }
    return runContext;
}

async function updatePlot(msg:string){
    console.log('updatePlot called for:',msg);
    const reqIdStr = useAtlChartFilterStore().getReqId().toString();
    if( (chartStore.getRgtValues(reqIdStr).length > 0) &&
        (chartStore.getCycleValues(reqIdStr).length > 0) &&
        (chartStore.getSpotValues(reqIdStr).length > 0)
    ){
        const runContext = await getPhotonOverlayRunContext();
        if(runContext.reqId > 0){
            await prepareDbForReqId(runContext.reqId);            
            useAtl03ColorMapStore().setAtl03ColorKey('atl03_cnf');
        }
        await refreshScatterPlot(msg);
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const chunkSize = useSrParquetCfgStore().getChunkSizeToRead();
        await duckDbReadAndUpdateSelectedLayer(useAtlChartFilterStore().getReqId(),chunkSize,maxNumPnts);
    } else {
        console.warn('Need Rgt, Cycle, and Spot values selected');
        console.warn('Rgt:', chartStore.getRgtValues(reqIdStr));
        console.warn('Cycle:', chartStore.getCycleValues(reqIdStr));
        console.warn('Spot:', chartStore.getSpotValues(reqIdStr));
    }
}
let updatePlotTimeoutId: number | undefined;
let pendingResolves: Array<() => void> = [];


export async function callPlotUpdateDebounced(msg: string): Promise<void> {
    console.log("callPlotUpdateDebounced called for:", msg);
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
    const item = atlChartFilterStore.reqIdMenuItems.find(
        (i) => i.value === reqId
    )
    return item ? item.label : 'unknown'
}

export async function initSymbolSize(req_id: number):Promise<number>{
    const reqIdStr = req_id.toString();
    const func = await indexedDb.getFunc(req_id);
    const plotConfig = await indexedDb.getPlotConfig();
    if (func.includes('atl03sp')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl03SymbolSize  ?? 1));
    } else if (func.includes('atl03vp')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl03SymbolSize  ?? 1));
    } else if (func.includes('atl06')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl06SymbolSize  ?? 3));
    } else if (func.includes('atl08')) {
        chartStore.setSymbolSize(reqIdStr,(plotConfig?.defaultAtl08SymbolSize  ?? 3));
    } else {
        console.error('initSymbolSize unknown function:', func);
    }
    console.log('initSymbolSize reqId:', req_id, 'func:', func, 'symbolSize:', chartStore.getSymbolSize(reqIdStr));
    return chartStore.getSymbolSize(reqIdStr);
}

export async function updateChartStore(req_id: number) {
    console.log('updateChartStore req_id:', req_id);
    const reqIdStr = req_id.toString();
    if (req_id <= 0) {
        console.warn(`updateChartStore Invalid request ID:${req_id}`);
        return;
    }
    try {
        const reqIdStr = req_id.toString();
        const func = await indexedDb.getFunc(req_id);
        //console.log('updateChartStore req_id:', req_id, 'func:', func);
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        await chartStore.setFunc(reqIdStr,func);
        const whereClause = createWhereClause(
            chartStore.getFunc(reqIdStr),
            chartStore.getSpotValues(reqIdStr),
            chartStore.getRgtValues(reqIdStr),
            chartStore.getCycleValues(reqIdStr),
        );
        if(whereClause !== ''){
            chartStore.setWhereClause(reqIdStr,whereClause);
        }
        //console.log('setFunc calling setSymbolSize for reqIdStr:',reqIdStr, 'func:',func, 'plotConfig:',plotConfig);


    } catch (error) {
        console.warn('updateChartStore Failed to update selected request:', error);
    }
}
