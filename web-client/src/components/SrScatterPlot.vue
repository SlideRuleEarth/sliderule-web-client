<template>
    <div class="sr-scatter-plot-container">
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="useChartStore().getShowMessage()" :class="messageClass">{{useChartStore().getMessage(computedReqIdStr)}}</div>
            <div class="sr-multiselect-container">
                <FloatLabel variant="on">
                    <MultiSelect
                        class="sr-multiselect" 
                        id="myID"
                        v-model="yDataForChart"
                        size="small" 
                        :options="computedYOptions"
                        display="chip"
                    />
                    <label for="myID"> {{ computedPlaceholder }}</label>
                </FloatLabel>
            </div>
        </div>
        <div class="sr-scatter-plot-content">
            <v-chart  ref="plotRef" 
              class="scatter-chart" 
              :manual-update="true"
              :autoresize="{throttle:500}" 
              :loading="atlChartFilterStore.isLoading" 
              :loadingOptions="{
                text:'Data Loading', 
                fontSize:20, 
                showSpinner: true, 
                zlevel:100
              }" 
            />
            <SrAtl03ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl03_cnf')   && (atlChartFilterStore.getFunc() === 'atl03sp'))" />
            <SrAtl08ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl08_class') && (atlChartFilterStore.getFunc() === 'atl03sp'))" />
          </div> 
    </div>
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { debounce } from "lodash";
import { useAtl03ColorMapStore } from "@/stores/atl03ColorMapStore";
import { fetchScatterOptions,clearPlot } from "@/utils/plotUtils";
import SrAtl03ColorLegend from "./SrAtl03ColorLegend.vue";
import SrAtl08ColorLegend from "./SrAtl08ColorLegend.vue";
import { useChartStore } from "@/stores/chartStore";

const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const computedReqIdStr = computed(() => atlChartFilterStore.currentReqId.toString());
const yDataForChart = computed({
    get() { 
        return useChartStore().stateByReqId[atlChartFilterStore.currentReqId.toString()]?.yDataForChart || [];
    },
    set(value: string[]) {
        useChartStore().setYDataForChart(computedReqIdStr.value, value);
    }
});

const computedPlaceholder = computed(() => {
  return `Y Data for ${computedReqIdStr.value}`;
});
const computedYOptions = computed(() => useChartStore().getElevationDataOptions(computedReqIdStr.value));
use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);

onMounted(async () => {
  try {
    atlChartFilterStore.setPlotRef(plotRef.value);
    const reqId = atlChartFilterStore.getReqId();
    if (reqId > 0) {
      const func = await indexedDb.getFunc(reqId);
      atl03ColorMapStore.initializeAtl03ColorMapStore();
      if (func === 'atl03sp') {
        atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
      } else if (func.includes('atl06')) {
        atl03ColorMapStore.setAtl03ColorKey('YAPC');
      } else if (func.includes('atl08')) {
        atl03ColorMapStore.setAtl03ColorKey('atl08_class');
      }
      debouncedFetchScatterOptions();
    } else {
      console.warn('reqId is undefined');
    }
  } catch (error) {
    console.error('Error during onMounted initialization:', error);
  }
});



const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);

// watch(() => atlChartFilterStore.clearScatterPlotFlag, async (newState) => {
//   if (newState === true) {
//     clearPlot();
//     atlChartFilterStore.resetClearScatterPlotFlag();
//   }
// }, { deep: true });

// async function changedYValues(event: any) {
//   console.log('changedYValues:', yDataForChart.value);
//   //useChartStore().setYDataForChart(computedReqIdStr.value,yDataForChart.value);
//   fetchScatterOptions();
// };

watch(
  yDataForChart,
  (newVal, oldVal) => {
    console.log('yDataForChart changed:', oldVal, '->', newVal);
    clearPlot();
   fetchScatterOptions();
},
  { deep: true }
);

watch(() => atlChartFilterStore.getReqId(), async (newReqId) => {
  if (newReqId && (newReqId > 0)) {
    clearPlot();
    fetchScatterOptions();
  }
});

watch(() => atlChartFilterStore.updateScatterPlotCnt, async () => {
  //console.log('Watch updateScatterPlotCnt:', atlChartFilterStore.updateScatterPlotCnt);
  debouncedFetchScatterOptions();
});

const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !useChartStore().getIsWarning(computedReqIdStr.value),
    'message-yellow': useChartStore().getIsWarning(computedReqIdStr.value)
  };
});

const computedSelectedAtl03ColorMap = computed(() => {
  return atlChartFilterStore.getSelectedAtl03ColorMap();
});

watch (() => computedSelectedAtl03ColorMap, async (newColorMap, oldColorMap) => {    
    //console.log('Atl03ColorMap changed from:', oldColorMap ,' to:', newColorMap);
    atl03ColorMapStore.setAtl03YapcColorMap(newColorMap.value.value);
    atl03ColorMapStore.updateAtl03YapcColorMapValues();
    //console.log('Color Map:', atl03ColorMapStore.getAtl03YapcColorMap());
    debouncedFetchScatterOptions();
  }, { deep: true, immediate: true });


</script>

<style scoped>

.scatter-chart{
  height: 60vh;
  margin: 0.5rem;
}

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
  width: auto;
}
.sr-scatter-plot-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: left;
  margin: 0rem;
  padding: 0rem;
  overflow-y: auto;
  overflow-x: auto;
  height: 100%;
  width: auto;
}

.sr-scatter-plot-options {
  display: flex; 
  flex-direction: column;
  align-items: self-start;
  margin: 0.5rem;
  width: auto; /* Add this line to ensure it only takes as much width as needed */
  overflow-y: auto;
}

.sr-multiselect-container {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 1rem;
  border: 0.5rem;
}

.sr-multiselect {
    width: 100%;
}

.sr-select-color-key {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 1rem;
  border: 0.5rem;
}

.sr-select-color-map {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 1rem;
  border: 0.5rem;
}

.sr-select-symbol-size {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 1rem;
  border: 0.5rem;
}

.sr-sql-stmnt-display-parms {
  display: flex;
  flex-direction: column;
  justify-content: left;
  align-items: left;
  margin-top: 0rem;
  overflow-y: auto;
  overflow-x: auto;
}

.loading-indicator {
  margin-left: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  color: #ffcc00; /* Yellow color */
}

.message {
  margin-left: 1rem;
  margin-bottom: 0.5rem;
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
