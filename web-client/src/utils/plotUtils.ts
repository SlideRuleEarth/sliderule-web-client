import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import type { SrScatterOptionsParms } from '@/utils/parmUtils';
import { useAtl03ColorMapStore }  from "@/stores/atl03ColorMapStore";
import { fetchAtl03spScatterData, fetchAtl03vpScatterData, fetchAtl06ScatterData, fetchAtl08ScatterData } from "@/utils/SrDuckDbUtils";

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

let debugCnt = 0;
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


async function getSeriesForAtl03sp(reqIdStr:string, fileName: string, x: string, y: string[]): Promise<SrScatterSeriesData[]> {
  //console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y);
  const startTime = performance.now(); // Start time
  let yItems = [] as SrScatterSeriesData[];

  try {
      const name = 'Atl03sp';
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
                  itemStyle: {
                      color: getAtl03spColor,
                  },
                  large: useAtlChartFilterStore().getLargeData(),
                  largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                  animation: false,
                  yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                  symbolSize: useAtlChartFilterStore().getSymbolSize(name),
              },
              min: min,
              max: max
          };
      });
      // Log the total number of points across all series
      const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
      useAtlChartFilterStore().setNumOfPlottedPnts(totalPoints);
      //console.log(`Total number of points across all series: ${totalPoints}`);

  } catch (error) {
      console.error('getSeriesForAtl03sp Error:', error);
  } finally {
      const endTime = performance.now(); // End time
      console.log(`getSeriesForAtl03sp took ${endTime - startTime} milliseconds.`);
  }

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
      const name = 'Atl03vp';
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
                  large: useAtlChartFilterStore().getLargeData(),
                  largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                  animation: false,
                  yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                  symbolSize: useAtlChartFilterStore().getSymbolSize(name),
              },
              min: min,
              max: max
          };
      });
      // Log the total number of points across all series
      const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
      useAtlChartFilterStore().setNumOfPlottedPnts(totalPoints);
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
      const name = 'Atl06';
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
                  large: useAtlChartFilterStore().getLargeData(),
                  largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
                  animation: false,
                  yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                  symbolSize: useAtlChartFilterStore().getSymbolSize(name),
              },
              min: min,
              max: max
          };
      });
      const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
      useAtlChartFilterStore().setNumOfPlottedPnts(totalPoints);
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
      const name = 'Atl08';
      const { chartData={}, normalizedMinMaxValues={} } = await fetchAtl08ScatterData(reqIdStr,fileName, x, y);
      console.log('getSeriesForAtl08 chartData:', chartData, ' minMaxValues:', normalizedMinMaxValues);
      if (Object.keys(chartData).length === 0 || Object.keys(normalizedMinMaxValues).length === 0) {
          console.warn('getSeriesForAtl08 chartData or minMaxValues is empty, skipping processing.');
      } else {
          yItems = y.map(yName => ({
              name: `${name} - ${yName}`,
              type: 'scatter',
              data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
              large: useAtlChartFilterStore().getLargeData(),
              largeThreshold: useAtlChartFilterStore().getLargeDataThreshold(),
              animation: false,
              yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
              symbolSize: useAtlChartFilterStore().getSymbolSize(name),
          })).map((series, index) => ({
              series,
              min: normalizedMinMaxValues[y[index]].min,
              max: normalizedMinMaxValues[y[index]].max
          }));
      }
      const totalPoints = yItems.reduce((sum, series) => sum + series.series.data.length, 0);
      useAtlChartFilterStore().setNumOfPlottedPnts(totalPoints);
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

export const getScatterOptionsParms = (reqIdStr:string): SrScatterOptionsParms => {

    //console.log('atlChartFilterStore.getScatterOptionsParms() this.rgts[0]?.value:',this.rgts[0]?.value);
    const sop =  {
        reqIdStr: reqIdStr,
        rgts: atlChartFilterStore.rgts.map(rgt => rgt?.value).filter(value => value !== undefined),
        cycles: atlChartFilterStore.cycles.map(cycle => cycle?.value).filter(value => value !== undefined),
        fileName: chartStore.getCurrentFile(reqIdStr),
        func: chartStore.getFunc(reqIdStr),
        y: chartStore.getYDataForChart(reqIdStr),
        x: chartStore.getXDataForChart(reqIdStr),
        beams: atlChartFilterStore.beams.map(beam => beam.value),
        spots: atlChartFilterStore.spots.map(spot => spot.value),
        pairs: atlChartFilterStore.pairs.map(pair => pair.value).filter(value => value !== undefined),
        scOrients: atlChartFilterStore.scOrients.map(scOrient => scOrient.value).filter(value => value !== undefined),
        tracks: atlChartFilterStore.tracks.map(track => track.value),
    };
    //console.log('atlChartFilterStore.getScatterOptionsParms():', sop);
    return sop;

}

export async function getScatterOptions(req_id:number): Promise<any> {
  const startTime = performance.now(); // Start time
  const reqIdStr = req_id.toString();
  const sop = getScatterOptionsParms(reqIdStr);
  //console.log('getScatterOptions sop:', sop);
  let options = null;
  try{
      let seriesData = [] as SrScatterSeriesData[];
      if(sop.fileName){
          if(sop.spots?.length && sop.rgts && sop.cycles){
              if(sop.func==='atl03sp'){
                  seriesData = await getSeriesForAtl03sp(sop.reqIdStr, sop.fileName, sop.x, sop.y);
              } else if(sop.func==='atl03vp'){
                  seriesData = await getSeriesForAtl03vp(sop.reqIdStr, sop.fileName, sop.x, sop.y);
              } else if(sop.func.includes('atl06')){
                  seriesData = await getSeriesForAtl06(sop.reqIdStr, sop.fileName, sop.x, sop.y);
              } else if(sop.func.includes('atl08')){
                  seriesData = await getSeriesForAtl08(sop.reqIdStr, sop.fileName, sop.x, sop.y);
              } else {
                  console.error('getScatterOptions invalid func:', sop.func);
              }
              console.log('getScatterOptions seriesData:', seriesData);
          } else {
              console.warn('getScatterOptions invalid? spots:', sop.spots, ' rgt:', sop.rgts, ' cycle:', sop.cycles);
          }
      } else {
          console.warn('getScatterOptions fileName is null');
      }
      if(seriesData.length !== 0){
          options = {
              title: {
                  text: `${sop.func}`,
                  left: "center"
              },
              tooltip: {
                  trigger: "item",
                  formatter: function (params:any) {
                      //console.warn('getScatterOptions params:', params);
                      if(sop.func === 'atl03sp'){
                          const [x, y, atl03_cnf, atl08_class, yapc_score] = params.value;
                          return `x: ${x}<br>y: ${y}<br>atl03_cnf: ${atl03_cnf}<br>atl08_class: ${atl08_class}<br>yapc_score: ${yapc_score}`;
                      } else {
                          const [x, y, x_actual] = params.value;
                          return `x: ${x}<br>y: ${y} <br>x_actual: ${x_actual}`;
                      }
                  }
              },
              legend: {
                  data: seriesData.map(series => series.series.name),
                  left: 'left'
              },
              notMerge: true,
              lazyUpdate: true,
              xAxis: {
                  min: useChartStore().getMinX(reqIdStr),
                  max: useChartStore().getMaxX(reqIdStr),
                  name: useChartStore().getXLegend(reqIdStr), // Add the label for the x-axis here
                  nameLocation: 'middle', // Position the label in the middle of the axis
                  nameTextStyle: {
                      fontSize: 10,
                      padding:[10,0,10,0],
                      margin:10,
                  }
              },
              yAxis: seriesData.map((series, index) => ({
                  type: 'value',
                  name: sop.y[index],
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
      const endTime = performance.now(); // End time
      console.log(`getScatterOptions fileName:${sop.fileName} took ${endTime - startTime} milliseconds.`);
  }
return options;
}


export const fetchScatterOptions = async () => {
    const reqId = atlChartFilterStore.getReqId();
    const reqIdStr = reqId.toString();
    console.log('fetchScatterOptions reqId:', reqId, ' reqIdStr:', reqIdStr);
    if(reqId > 0){
      const y_options = chartStore.getYDataForChart(reqIdStr);
      console.log('fetchScatterOptions y_options:', y_options);
      if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
        chartStore.setShowMessage(reqIdStr,false);
        const startTime = performance.now(); // Start time
        console.log('fetchScatterOptions started... startTime:',startTime)
        try {
          atlChartFilterStore.setIsLoading();
          const req_id = atlChartFilterStore.getReqId();
          const reqIdStr = req_id.toString();
          const func = await indexedDb.getFunc(req_id);
          atlChartFilterStore.setFunc(reqIdStr,func);
          chartStore.setFunc(reqIdStr,func);
          chartStore.setXDataForChartUsingFunc(reqIdStr,func);
          //const sop = getScatterOptionsParms(reqIdStr);
          //console.log('fetchScatterOptions sop:',sop);
          //const scatterOptions = await getScatterOptions(sop);
          const scatterOptions = await getScatterOptions(req_id);
          //console.log(`returned from getScatterOptions in:${performance.now() - startTime} milliseconds.` )
          if (scatterOptions) {
            const plotRef = atlChartFilterStore.getPlotRef();
            if(plotRef){
              if(plotRef.chart){
                  console.log('fetchScatterOptions plotRef.chart.setOption:',scatterOptions);
                  plotRef.chart.setOption(scatterOptions);
                  const newOptions = plotRef.chart.getOption();
                  //console.log('fetchScatterOptions plotRef.chart.getOption:',newOptions);
                  //srObjectDetailsRef.value?.setObjectDetails(newOptions);
              } else {
                  console.warn('fetchScatterOptions plotRef.chart is undefined');
              }
            } else {
              console.warn('fetchScatterOptions plotRef is undefined');
            }
          } else {
            //console.log('fetchScatterOptions Failed to get scatter options');
            chartStore.setShowMessage(reqIdStr,true);
            chartStore.setIsWarning(reqIdStr,true);
            chartStore.setMessage(reqIdStr,'Failed to load data. Click on elevation in map to preset filters');
          }
        } catch (error) {
          console.error('fetchScatterOptions Error fetching scatter options:', error);
          chartStore.setShowMessage(reqIdStr,true);
          chartStore.setMessage(reqIdStr,'Failed to load data. Please try again later.');
        } finally {
          atlChartFilterStore.resetIsLoading();
          const now = performance.now();
          //console.log(`fetchScatterOptions took ${now - startTime} milliseconds. endTime:`,now);
        }
      } else {
        console.warn('fetchScatterOptions No y options selected');
      }
    } else {
      console.error('fetchScatterOptions reqId is undefined');
    }
  };
  