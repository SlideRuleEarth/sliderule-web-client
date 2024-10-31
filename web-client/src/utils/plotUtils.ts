import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import { db as indexedDb } from "@/db/SlideRuleDb";


const atlChartFilterStore = useAtlChartFilterStore();
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

export const fetchScatterOptions = async () => {
    const reqId = atlChartFilterStore.getReqId();
    if(reqId > 0){
      const y_options = atlChartFilterStore.getYDataForChart();
      if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
        atlChartFilterStore.setShowMessage(false);
        const startTime = performance.now(); // Start time
        console.log('fetchScatterOptions started... startTime:',startTime)
        try {
          atlChartFilterStore.setIsLoading();
          const req_id = atlChartFilterStore.getReqId();
          const func = await indexedDb.getFunc(req_id);
          atlChartFilterStore.setFunc(func);
          atlChartFilterStore.setXDataForChartUsingFunc(func);
          const sop = atlChartFilterStore.getScatterOptionsParms();
          //console.log('fetchScatterOptions sop:',sop);
          const scatterOptions = await getScatterOptions(sop);
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
            atlChartFilterStore.setShowMessage(true);
            atlChartFilterStore.setIsWarning(true);
            atlChartFilterStore.setMessage('Failed to load data. Click on elevation in map to preset filters');
          }
        } catch (error) {
          console.error('fetchScatterOptions Error fetching scatter options:', error);
          atlChartFilterStore.setShowMessage(true);
          atlChartFilterStore.setMessage('Failed to load data. Please try again later.');
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
  