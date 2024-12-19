import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { useAtl03ColorMapStore }  from "@/stores/atl03ColorMapStore";
import { fetchAtl03spScatterData, fetchAtl03vpScatterData, fetchAtl06ScatterData, fetchAtl08ScatterData } from "@/utils/SrDuckDbUtils";
import type { EChartsOption, LegendComponentOption, ScatterSeriesOption, EChartsType } from 'echarts';
import { createWhereClause } from "./spotUtils";
import type { ECharts } from 'echarts/core';
import { debounce } from "lodash";

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
                    name: yName,
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
                name: yName,
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

function clearPlot() {
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
                console.error(`getSeriesFor ${reqIdStr} invalid func:`, func);
            }
            //console.log(`getSeriesFor ${reqIdStr} seriesData:`, seriesData);
        } else {
            console.warn(`getSeriesFor ${reqIdStr} fileName is null`);
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
        //console.log(`getScatterOptions options for: ${reqIdStr}:`, options);
        const endTime = performance.now(); // End time
        console.log(`getScatterOptions fileName:${fileName} took ${endTime - startTime} milliseconds.`);
        return options;
    }
}

const initScatterPlotWith = async (reqId: number) => {
    const startTime = performance.now();
    //console.log(`initScatterPlotWith ${reqId} startTime:`, startTime);

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

    //console.log(`initScatterPlotWith ${reqId} y_options:`, y_options);
    const msg = '';
    chartStore.setShowMessage(reqIdStr, false);
    if (!y_options.length || y_options[0] === 'not_set') {
        console.warn(`initScatterPlotWith ${reqId} No y options selected`);
        chartStore.setShowMessage(reqIdStr, true);
        chartStore.setIsWarning(reqIdStr, true);
        chartStore.setMessage(reqIdStr, 'No Y options selected');
    } else {
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
                //console.log(`initScatterPlotWith Options applied to chart:`, newScatterOptions);
                const options = plotRef.chart.getOption();
                //console.log(`initScatterPlotWith ${reqId} Options from chart:`, options);
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
        //console.log(`appendSeries(${reqIdStr}): Existing options:`, existingOptions);

        // Fetch series data for the given reqIdStr
        const seriesData = await getSeriesFor(reqIdStr);
        //console.log('seriesData:', seriesData);
        if (!seriesData.length) {
            console.warn(`appendSeries(${reqIdStr}): No series data found.`);
            return;
        }
        //console.log(`appendSeries(${reqIdStr}): Series data:`, seriesData);

        // Define the fields that should share a single axis
        const heightFields = ['height', 'h_mean', 'h_mean_canopy'];

        // Separate series into "height" group and "non-height" group
        const heightSeriesData = seriesData.filter(d => heightFields.includes(d.series.name));
        const nonHeightSeriesData = seriesData.filter(d => !heightFields.includes(d.series.name));

        let updatedSeries = [
            ...(Array.isArray(filteredOptions.series) ? filteredOptions.series : []),
        ];

        let updatedYAxis = Array.isArray(filteredOptions.yAxis) ? [...filteredOptions.yAxis] : [];

        // Find if there's already a height axis
        let heightYAxisIndex: number | null = null;
        let existingHeightFields: string[] = [];
        let existingHeightMin = Number.POSITIVE_INFINITY;
        let existingHeightMax = Number.NEGATIVE_INFINITY;

        // Identify an existing height axis by checking its name against known height fields
        for (let i = 0; i < updatedYAxis.length; i++) {
            const axis = updatedYAxis[i];
            if (axis && axis.name) {
                // The name could be a combination of fields. Split by comma if multiple
                const axisNames = axis.name.split(',').map((n:string) => n.trim());
                // Check if any of the known height fields appear in the axis name
                if (axisNames.some((n:string) => heightFields.includes(n))) {
                    heightYAxisIndex = i;
                    existingHeightFields = axisNames;
                    // Extract current min/max
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

            // Combine with existing if found
            if (heightYAxisIndex !== null) {
                // Update existing height axis
                // Combine field names
                const allHeightFieldsCombined = Array.from(new Set([...existingHeightFields, ...heightNames]));
                // Update min/max if needed
                const combinedMin = Math.min(existingHeightMin, heightMin);
                const combinedMax = Math.max(existingHeightMax, heightMax);

                updatedYAxis[heightYAxisIndex] = {
                    ...updatedYAxis[heightYAxisIndex],
                    name: allHeightFieldsCombined.join(', '),
                    min: combinedMin,
                    max: combinedMax
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
                yAxisIndex: heightYAxisIndex as number
            }));
            updatedSeries = updatedSeries.concat(mappedHeightSeries);
        }

        // For non-height data, each one gets its own axis as a new axis after the existing ones
        const mappedNonHeightSeries = nonHeightSeriesData.map(d => {
            // Add a new axis for this non-height series
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
                yAxisIndex: nonHeightAxisIndex
            };
        });
        updatedSeries = updatedSeries.concat(mappedNonHeightSeries);

        //console.log(`appendSeries(${reqIdStr}): Updated series:`, updatedSeries);
        //console.log(`appendSeries(${reqIdStr}): Updated yAxis:`, updatedYAxis);

        // Apply the updated options to the chart
        chart.setOption({
            ...filteredOptions,
            series: updatedSeries,
            yAxis: updatedYAxis,
        });
        console.log(`appendSeries(${reqIdStr}): Successfully appended scatter series and updated yAxis.`);
    } catch (error) {
        console.error(`appendSeries(${reqId}): Error appending scatter series.`, error);
    }
}

export const refreshScatterPlot = async (msg:string) => {
    //console.log(`refreshScatterPlot ${msg}`);
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        clearPlot();
        await initScatterPlotWith(useAtlChartFilterStore().getReqId());
        await debouncedUpdateScatterPlot();
    } else {
        console.warn(`Ignoring refreshScatterPlot with no plot to refresh, plotRef is undefined.`);
    }
};

const debouncedUpdateScatterPlot = debounce(async () => {
    await updateScatterPlot();
}, 500);

const updateScatterPlot = async () => {
    const startTime = performance.now();
    //console.log(`updateScatterPlot startTime:`, startTime);
    // Retrieve existing options from the chart
    const plotRef = useAtlChartFilterStore().getPlotRef();
    if (plotRef && plotRef.chart) {
        const reqIds = useAtlChartFilterStore().getSelectedOverlayedReqIds();
        //console.log(`updateScatterPlot reqIds:`, reqIds);
        reqIds.forEach(reqId => { 
            if(reqId > 0){
                appendSeries(reqId);
            } else {
                console.error(`updateScatterPlot Invalid request ID:${reqId}`);
            }
        });
    } else {
        console.warn(`Ignoring updateScatterPlot with no plot to update, plotRef is undefined.`);
    }
}

export function initSymbolSize(reqIdStr: string) {
    //console.log('setSymbolSize reqIdStr:',reqIdStr);
    const func = chartStore.stateByReqId[reqIdStr].func;
    if (func.includes('atl03sp')) {
        chartStore.stateByReqId[reqIdStr].symbolSize = 1;
    } else if (func.includes('atl03vp')) {
        chartStore.stateByReqId[reqIdStr].symbolSize = 3;
    } else if (func.includes('atl06')) {
        chartStore.stateByReqId[reqIdStr].symbolSize = 3;
    } else if (func.includes('atl08')) {
        chartStore.stateByReqId[reqIdStr].symbolSize = 3;
    }       
}

export async function updateChartStore(req_id: number) {
    //console.log('updateChartStore req_id:', req_id);
    if (req_id <= 0) {
        console.warn(`updateChartStore Invalid request ID:${req_id}`);
        return;
    }
    try {
        const reqIdStr = req_id.toString();
        const func = await indexedDb.getFunc(req_id);
        //console.log('updateChartStore req_id:', req_id, 'func:', func);
        chartStore.setXDataForChartUsingFunc(reqIdStr, func);
        chartStore.setFunc(reqIdStr,func);
        initSymbolSize(reqIdStr);
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
