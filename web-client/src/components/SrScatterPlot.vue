<template>
  <div class="sr-scatter-plot-header">
    <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
    <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
    <SrSqlStmnt />
    <div class="sr-multiselect-container">
      <SrMultiSelectText 
        v-model="atlChartFilterStore.yDataForChart"
        label="Choose" 
        @update:modelValue="changedYValues"
        menuPlaceholder="Select elevation data"
        :menuOptions="atlChartFilterStore.getElevationDataOptions()"
        :default="[atlChartFilterStore.getElevationDataOptions()[atlChartFilterStore.getNdxOfelevationDataOptionsForHeight()]]"
      />  
    </div>
  </div>
  <v-chart  ref="plotRef" 
            class="scatter-chart" 
            :option="option" 
            :autoresize="{throttle:500}" 
            :loading="atlChartFilterStore.isLoading" 
            :loadingOptions="{
              text:'Data Loading', 
              fontSize:20, 
              showSpinner: true, 
              zlevel:100
            }" />
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch, onMounted, ref, computed } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import SrMultiSelectText from "./SrMultiSelectText.vue";
import SrSqlStmnt from "./SrSqlStmnt.vue";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { debounce } from "lodash";

const atlChartFilterStore = useAtlChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

const option = shallowRef();
//const computedIsLoading = computed(() => atlChartFilterStore.getIsLoading());
const plotRef = ref<InstanceType<typeof VChart> | null>(null);

const fetchScatterOptions = async () => {
  const y_options = atlChartFilterStore.yDataForChart;
  if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
    atlChartFilterStore.setShowMessage(false);
    //await nextTick(); // Wait for the DOM to update
    const startTime = performance.now(); // Start time
    console.log('fetchScatterOptions started... startTime:',startTime)
    try {
      atlChartFilterStore.setIsLoading();
      const req_id = atlChartFilterStore.getReqId();
      const func = await indexedDb.getFunc(req_id);
      atlChartFilterStore.setFunc(func);
      const sop = atlChartFilterStore.getScatterOptionsParms();
      //console.log('fetchScatterOptions sop:',sop);
      const scatterOptions = await getScatterOptions(sop);
      console.log(`returned from getScatterOptions in:${performance.now() - startTime} milliseconds.` )
      if (scatterOptions) {
        if(plotRef.value){
          if(plotRef.value.chart){
            plotRef.value.chart.setOption(scatterOptions);
          } else {
            console.warn('fetchScatterOptions plotRef.chart is undefined');
          }
        } else {
          console.warn('fetchScatterOptions plotRef is undefined');
        }
      } else {
        console.log('fetchScatterOptions Failed to get scatter options');
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
      console.log(`fetchScatterOptions took ${now - startTime} milliseconds. endTime:`,now);
    }
  } else {
    console.warn('fetchScatterOptions No y options selected');
  }
};

onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  if (reqId > 0) {
    debouncedFetchScatterOptions();
  } else {
    console.warn('reqId is undefined');
  }
});

function clearPlot() {
  if (plotRef.value) {
    if(plotRef.value.chart){
      plotRef.value.chart.clear();
    } else {
      console.warn('plotRef.value.chart is undefined');
    }
  } else {
    console.warn('plotRef.value is undefined');
  }
}

const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);

watch(() => atlChartFilterStore.clearPlot, async (newState) => {
  if (newState === true) {
    clearPlot();
    atlChartFilterStore.resetClearPlot();
  }
}, { deep: true });


async function changedYValues() {
  debouncedFetchScatterOptions();
}

watch(() => curReqSumStore.getReqId(), async (newReqId) => {
  if (newReqId && (newReqId > 0)) {
    clearPlot();
    fetchScatterOptions();
  }
});

watch(() => atlChartFilterStore.updateScatterPlotCnt, async () => {
  console.log('Watch updateScatterPlotCnt:', atlChartFilterStore.updateScatterPlotCnt);
  debouncedFetchScatterOptions();
});



const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !atlChartFilterStore.getIsWarning(),
    'message-yellow': atlChartFilterStore.getIsWarning()
  };
});

</script>

<style scoped>
.sr-scatter-plot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

.sr-scatter-plot-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: left;
  margin: 0.5rem;
  padding: 1rem;
  overflow-y: auto;
  overflow-x: auto;
}

.sr-multiselect-container {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 0rem;
  border: 0rem;
}

.sr-sql-stmnt-display-parms {
  display: flex;
  align-items: left;
  margin-top: 0rem;
  overflow-y: auto;
  overflow-x: auto;
}

.loading-indicator {
  margin-left: 1rem;
  font-size: 1.2rem;
  color: #ffcc00; /* Yellow color */
}

.message {
  margin-left: 1rem;
  font-size: 1.2rem;
}

.message-red {
  color: #ff0000; /* Red color */
}

.message-yellow {
  color: #ffcc00; /* Yellow color */
}

.scatter-chart {
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  max-height: 50rem;
  max-width: 80rem;
}
</style>
