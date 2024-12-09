import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { useAtl03ColorMapStore }  from "@/stores/atl03ColorMapStore";
import { fetchAtl03spScatterData, fetchAtl03vpScatterData, fetchAtl06ScatterData, fetchAtl08ScatterData } from "@/utils/SrDuckDbUtils";
import type { EChartsOption, LegendComponentOption, ScatterSeriesOption, EChartsType } from 'echarts';
import { createWhereClause } from "./spotUtils";
import type { ECharts } from 'echarts/core';

const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();

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

let debugCnt = 10;
function getAtl03spColor(params: any):string {
    if(debugCnt++ < 10){
        console.log('getAtl03spColor Atl03ColorKey:', useAtl03ColorMapStore().getAtl03ColorKey());
        console.log('getAtl03spColor params.data:', params.data);
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
        console.log(`getAtl03spColor cnt:${debugCnt} value:${value} colorStr:${colorStr}`);
    }
    return colorStr;
}


async function getSeriesForAtl03sp(
    reqIdStr:string, 
    fileName: string, 
    x: string, 
    y: string[]
): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y);
    const startTime = performance.now(); // Start time
    let yItems = [] as SrScatterSeriesData[];
    try {
        const name = 'atl03sp';
        const { chartData = {}, minMaxValues = {} } = await fetchAtl03spScatterData(reqIdStr,fileName, x, y);
        //console.log('getSeriesForAtl03sp chartData:', chartData, ' minMaxValues:', minMaxValues);
        // Check if either chartData or minMaxValues is empty
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn('getSeriesForAtl03sp chartData or minMaxValues is empty, skipping processing.');
            return yItems; // Return empty array if either is empty
        }

        yItems = y.map(yName => {
            const data = chartData[yName] ? chartData[yName].map(item => item.value) : [];
            const min = minMaxValues[yName]?.min ?? null; // Default to null if minMaxValues[yName] or min is undefined
            const max = minMaxValues[yName]?.max ?? null; // Default to null if minMaxValues[yName] or max is undefined

            return {
                series: {
                    name: `${name} - ${yName}`,
                    type: 'scatter',
                    data: data,
                    encode: {
                        x: 0,
                        y: 1
                      },
                    itemStyle: {
                        color: getAtl03spColor,
                    },
                    large: useAtlChartFilterStore().getLargeData(),
                    largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
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
    console.log('getSeriesForAtl03sp yItems:', yItems);
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
                  name: `${name} - ${yName}`,
                  type: 'scatter',
                  data: data,
                  encode: {
                    x: 0,
                    y: 1
                  },
                  large: useAtlChartFilterStore().getLargeData(),
                  largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
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
                  name: `${name} - ${yName}`,
                  type: 'scatter',
                  data: data,
                  encode: {
                    x: 0,
                    y: 1
                  },
                  large: useAtlChartFilterStore().getLargeData(),
                  largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
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
  console.log('getSeriesForAtl06 yItems:', yItems);
  return yItems;
}

async function getSeriesForAtl08(
    reqIdStr:string, 
    fileName: string, 
    x: string, 
    y: string[]
): Promise<SrScatterSeriesData[]> {
    console.log('getSeriesForAtl08 fileName:', fileName, ' x:', x, ' y:', y);
    const startTime = performance.now();
    let yItems=[] as SrScatterSeriesData[];
    try{
      const name = 'atl08';
      const { chartData={}, normalizedMinMaxValues={} } = await fetchAtl08ScatterData(reqIdStr,fileName, x, y);
      console.log('getSeriesForAtl08 chartData:', chartData, ' minMaxValues:', normalizedMinMaxValues);
      if (Object.keys(chartData).length === 0 || Object.keys(normalizedMinMaxValues).length === 0) {
          console.warn('getSeriesForAtl08 chartData or minMaxValues is empty, skipping processing.');
      } else {
          yItems = y.map(yName => ({
              name: `${name} - ${yName}`,
              type: 'scatter',
              data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
              encode: {
                x: 0,
                y: 1
              },
          large: useAtlChartFilterStore().getLargeData(),
              largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
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
      console.log(`getSeriesForAtl08 Total number of points across all series: ${totalPoints}`);
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
    const y = chartStore.getYDataForChart(reqIdStr);
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
                console.error('getSeriesFor invalid func:', func);
            }
            console.log('getSeriesFor seriesData:', seriesData);
        } else {
            console.warn('getSeriesFor fileName is null');
        }
    } catch (error) {
        console.error('getSeriesFor Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesFor ${reqIdStr} fileName:${fileName} took ${endTime - startTime} milliseconds.`);
    }
    return seriesData;
}

export async function getScatterOptions(req_id:number): Promise<any> {
    const startTime = performance.now(); // Start time
    const reqIdStr = req_id.toString();
    const fileName = chartStore.getFile(reqIdStr);
    const func = chartStore.getFunc(reqIdStr);
    const y = chartStore.getYDataForChart(reqIdStr);
    const x = chartStore.getXDataForChart(reqIdStr);
    const rgts = atlChartFilterStore.rgts.map(rgt => rgt?.value).filter(value => value !== undefined);
    const cycles = atlChartFilterStore.cycles.map(cycle => cycle?.value).filter(value => value !== undefined);
    const spots = atlChartFilterStore.spots.map(spot => spot.value);
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
                    text: `${func}`,
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
        console.log(`getScatterOptions options for: ${reqIdStr}:`, options);
    }
    const endTime = performance.now(); // End time
    console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`);
    return options;
}

export const initScatterPlotWith = async (reqId: number) => {
    const startTime = performance.now();
    console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

    const plotRef = atlChartFilterStore.getPlotRef();
    if (!plotRef || !plotRef.chart) {
        console.warn(`initScatterPlotWith ${reqId} plotRef is undefined`);
        return;
    }

    if (reqId === undefined || reqId <= 0) {
        console.error(`initScatterPlotWith ${reqId} reqId is empty or invalid`);
        return;
    }
    updateChartStore(reqId);

    let newScatterOptions: EChartsOption = {}; // Initialize a container for the merged options.

    const reqIdStr = reqId.toString();
    const y_options = chartStore.getYDataForChart(reqIdStr);

    console.log(`initScatterPlotWith ${reqId} y_options:`, y_options);

    if (!y_options.length || y_options[0] === 'not_set') {
        console.warn(`initScatterPlotWith ${reqId} No y options selected`);
    }

    chartStore.setShowMessage(reqIdStr, false);

    try {
        atlChartFilterStore.setIsLoading();

        newScatterOptions = await getScatterOptions(reqId);
        if (!newScatterOptions) {
            chartStore.setShowMessage(reqIdStr, true);
            chartStore.setIsWarning(reqIdStr, true);
            chartStore.setMessage(reqIdStr, `Failed to load data. Click on elevation in map to preset filters`);
            return;
        }

        if (Object.keys(newScatterOptions).length > 0) {
            plotRef.chart.setOption(newScatterOptions);
            console.log(`initScatterPlotWith Options applied to chart:`, newScatterOptions);
            const options = plotRef.chart.getOption();
            console.log(`initScatterPlotWith ${reqId} Options from chart:`, options);
        } else {
            console.warn(`initScatterPlotWith No valid options to apply to chart`);
        }

    } catch (error) {
        console.error(`initScatterPlotWith ${reqId} Error fetching scatter options:`, error);
        chartStore.setShowMessage(reqIdStr, true);
        chartStore.setMessage(reqIdStr, 'Failed to load data. Please try again later.');
    } finally {
        atlChartFilterStore.resetIsLoading();
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
        //const existingOptions = removeUnusedOptions(chart.getOption());
        const existingOptions = chart.getOption() as EChartsOption;
        const filteredOptions = removeUnusedOptions(existingOptions);
        console.log(`appendSeries(${reqIdStr}): Existing options:`, existingOptions);

        // Fetch series data for the given reqIdStr
        const seriesData = await getSeriesFor(reqIdStr);

        if (!seriesData.length) {
            console.warn(`appendSeries(${reqIdStr}): No series data found.`);
            return;
        }
        console.log(`appendSeries(${reqIdStr}): Series data:`, seriesData);
        // Update series: Merge existing series with the new scatter series
        const updatedSeries = [
            ...(Array.isArray(filteredOptions.series) ? filteredOptions.series : []),
            ...seriesData.map(data => ({
                ...data.series,
                type: 'scatter', // Explicitly set to scatter
            })),
        ];
        console.log(`appendSeries(${reqIdStr}): Updated series:`, updatedSeries);
        // Update yAxis if necessary
        const updatedYAxis = [
            ...(Array.isArray(filteredOptions.yAxis) ? filteredOptions.yAxis : []),
            ...seriesData.map(data => ({
                type: 'value',
                name: data.series.name,
                min: data.min,
                max: data.max,
                scale: true,
                axisLabel: {
                    formatter: (value: number) => value.toFixed(1), // Format axis labels
                },
            })),
        ];
        console.log(`appendSeries(${reqIdStr}): Updated yAxis:`, updatedYAxis);
        // Apply the updated options to the chart
        chart.setOption({
            ...filteredOptions,
            series: updatedSeries,
            yAxis: updatedYAxis,
        });
        console.log(`appendSeries(${reqIdStr}): Successfully appended scatter series ${updatedSeries} yAxis:${updatedYAxis} to chart.`);
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}

export const updateScatterPlotFor = async (reqIds: number[]) => {
    const startTime = performance.now();
    console.log(`updateScatterPlotFor startTime ${reqIds} :`, startTime);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const chart: ECharts = plotRef.chart;

        // Retrieve existing options from the chart
        const existingOptions = removeUnusedOptions(chart.getOption());
        if(existingOptions.series){
            console.log(`updateScatterPlotFor ${reqIds} Existing options:`, existingOptions);
            for (const reqId of reqIds) {
                const f = chartStore.getFile(reqId.toString());
                if((f === undefined) || (f === null) || (f === '')){
                    const request = await indexedDb.getRequest(reqId);
                    console.log('Request:', request);
                    if(request && request.file){
                        chartStore.setFile(reqId.toString(),request.file);
                    } else {
                        console.error('No file found for req_id:', reqId);
                    }
                    if(request && request.func){
                        chartStore.setFunc(reqId.toString(),request.func);
                    } else {
                        console.error('No func found for req_id:', reqId);
                    }
                }
                appendSeries(reqId);
            }
        } else {
            console.log(`updateScatterPlotFor ${reqIds} existingOptions.series is empty`);
            initScatterPlotWith(reqIds[0]);
        }
    }
}


export async function updateChartStore(req_id: number) {
    console.log('updateChartStore req_id:', req_id);
    if (req_id <= 0) {
        console.warn(`updateChartStore Invalid request ID:${req_id}`);
        return;
    }
    try {
        const reqIdStr = req_id.toString();
        const func = await indexedDb.getFunc(req_id);
        console.log('updateChartStore req_id:', req_id, 'func:', func);
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        chartStore.setFunc(reqIdStr,func);
        chartStore.initSymbolSize(reqIdStr);
        const whereClause = createWhereClause(
            chartStore.getFunc(reqIdStr),
            useAtlChartFilterStore().getSpotValues(),
            useAtlChartFilterStore().getRgtValues(),
            useAtlChartFilterStore().getCycleValues(),
        );
        if(whereClause !== ''){
            chartStore.setWhereClause(reqIdStr,whereClause);
        }


    } catch (error) {
        console.warn('updateChartStore Failed to update selected request:', error);
    }
}
