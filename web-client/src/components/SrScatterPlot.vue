<template>
    <div class="sr-scatter-plot-container">
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
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
            <Fieldset class="sr-scatter-plot-options" legend="Plot Options" :toggleable="true" :collapsed="false">

            <div class="sr-data-set-options">
                <label>Num points in plot</label>
                {{ numberFormatter.format(useAtl03ColorMapStore().getNumOfPlottedPnts()) }}
                <SrSwitchedSliderInput 
                    v-model="atl03ColorMapStore.largeDataThreshold"
                    :getCheckboxValue="atl03ColorMapStore.getLargeData"
                    :setCheckboxValue="atl03ColorMapStore.setLargeData"
                    :getValue="atl03ColorMapStore.getLargeDataThreshold"
                    :setValue="atl03ColorMapStore.setLargeDataThreshold"
                    label="Large Data Threshold (optimization-single color)"
                    :min="1"
                    :max="1000000" 
                    :decimalPlaces="0"
                    tooltipText="Threshold for large data optimization using single color"
                    tooltipUrl="https://echarts.apache.org/en/option.html#series-scatter.large"
                />
            </div>

            <div class="sr-select-color-key">
                <SrMenu 
                        v-if = "atlChartFilterStore.getFunc().includes('atl03')"
                        label="Color Map Key" 
                        v-model="atl03ColorMapStore.atl03ColorKey"
                        @update:modelValue="changedColorKey"
                        :getSelectedMenuItem="atl03ColorMapStore.getAtl03ColorKey"
                        :setSelectedMenuItem="atl03ColorMapStore.setAtl03ColorKey"
                        :menuOptions="atl03ColorMapStore.getAtl03ColorKeyOptions()" 
                        tooltipText="Data key for Color of atl03 scatter plot"
                    /> 
            </div>
            <div class="sr-select-color-map">
                <SrMenuInput 
                    v-if = "atlChartFilterStore.getFunc().includes('atl03') && (atl03ColorMapStore.getAtl03ColorKey() == 'YAPC')"
                    label="Color Map" 
                    :menuOptions="getColorMapOptions()" 
                    v-model="selectedAtl03ColorMap"
                    tooltipText="Color Map for atl03 scatter plot"
                />
                <SrAtl03CnfColors 
                    v-if = "atlChartFilterStore.getFunc().includes('atl03') && (atl03ColorMapStore.getAtl03ColorKey() == 'atl03_cnf')"
                    @selectionChanged="atl03CnfColorChanged"
                    @defaultsChanged="atl03CnfColorChanged"
                    />
                <SrAtl08ClassColors 
                    v-if = "atlChartFilterStore.getFunc().includes('atl03') && (atl03ColorMapStore.getAtl03ColorKey() == 'atl08_class')"
                    @selectionChanged="atl08ClassColorChanged"
                    @defaultsChanged="atl08ClassColorChanged"
                />
            </div>
            <div class="sr-select-symbol-size">
                <SrSliderInput
                    v-if = "atlChartFilterStore.getFunc().includes('atl03')"
                    v-model="atlChartFilterStore.atl03SymbolSize"
                    @update:model-value="symbolSizeSelection"
                    label="Atl03 Scatter Plot symbol size"
                    :min="1"
                    :max="20"
                    :defaultValue="atlChartFilterStore.atl03SymbolSize"
                    :decimalPlaces=0
                    tooltipText="Symbol size for Atl03 Scatter Plot"
                />
                <SrSliderInput
                    v-if = "atlChartFilterStore.getFunc().includes('atl06')"
                    v-model="atlChartFilterStore.atl06SymbolSize"
                    @update:model-value="symbolSizeSelection"
                    label="Atl06 Scatter Plot symbol size"
                    :min="1"
                    :max="20"
                    :defaultValue="atlChartFilterStore.atl06SymbolSize"
                    :decimalPlaces=0
                    tooltipText="Symbol size for Atl06 Scatter Plot"
                />
                <SrSliderInput
                    v-if = "atlChartFilterStore.getFunc().includes('atl08')"
                    v-model="atlChartFilterStore.atl08SymbolSize"
                    @update:model-value="symbolSizeSelection"
                    label="Atl08 Scatter Plot symbol size"
                    :min="1"
                    :max="20"
                    :defaultValue="atlChartFilterStore.atl08SymbolSize"
                    :decimalPlaces=0
                    tooltipText="Symbol size for Atl08 Scatter Plot"
                />
            </div>  
            <div class="sr-sql-stmnt">
                <SrSqlStmnt />
            </div>
            </Fieldset>
        </div> 
    </div>
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import SrMultiSelectText from "./SrMultiSelectText.vue";
import SrSqlStmnt from "./SrSqlStmnt.vue";
import SrSliderInput from "./SrSliderInput.vue";
import Fieldset from "primevue/fieldset";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { debounce } from "lodash";
import SrMenuInput from "./SrMenuInput.vue";
import SrMenu from "./SrMenu.vue";
import SrAtl03CnfColors from "./SrAtl03CnfColors.vue";
import SrAtl08ClassColors from "./SrAtl08ClassColors.vue";
import { getColorMapOptions } from '@/utils/colorUtils';
import { useAtl03ColorMapStore } from "@/stores/atl03ColorMapStore";
import SrSwitchedSliderInput from "./SrSwitchedSliderInput.vue";

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const selectedAtl03ColorMap = ref({name:'viridis', value:'viridis'});
const plotRef = ref<InstanceType<typeof VChart> | null>(null);
interface AtColorChangeEvent {
  label: string;
  color?: string; // color can be undefined
}

const fetchScatterOptions = async () => {
  const reqId = atlChartFilterStore.getReqId();
  if(reqId > 0){
    const y_options = atlChartFilterStore.yDataForChart;
    if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
      atlChartFilterStore.setShowMessage(false);
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
                console.log('fetchScatterOptions plotRef.chart.setOption:',scatterOptions);
                plotRef.value.chart.setOption(scatterOptions);
                const newOptions = plotRef.value.chart.getOption();
                console.log('fetchScatterOptions plotRef.chart.getOption:',newOptions);
                //srObjectDetailsRef.value?.setObjectDetails(newOptions);
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
  } else {
    console.error('fetchScatterOptions reqId is undefined');
  }
};

onMounted(async () => {
    const reqId = atlChartFilterStore.getReqId();
    if (reqId > 0) {
        const func = await indexedDb.getFunc(reqId);
        atl03ColorMapStore.initializeAtl03ColorMapStore();
        if (func === 'atl03') {
        atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
        } else if (func === 'atl06') {
        atl03ColorMapStore.setAtl03ColorKey('YAPC');
        } else if (func === 'atl08') {
        atl03ColorMapStore.setAtl03ColorKey('atl08_class');
        }
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
function changedColorKey() {
    console.log('changedColorKey:', atl03ColorMapStore.getAtl03ColorKey());
    atlChartFilterStore.resetTheScatterPlot();
    debouncedFetchScatterOptions();
}

const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);

const atl03CnfColorChanged = (colorKey:string): void =>{
  console.log(`atl03CnfColorChanged:`,colorKey);
    clearPlot();
    debouncedFetchScatterOptions();
};

const atl08ClassColorChanged = ({ label, color }:AtColorChangeEvent): void => {
    console.log(`atl08ClassColorChanged received selection change: ${label} with color ${color}`);
    if (color) {
      clearPlot();
      debouncedFetchScatterOptions();
    } else {
      console.warn('atl08ClassColorChanged color is undefined');
    }
};

watch(() => atlChartFilterStore.clearScatterPlotFlag, async (newState) => {
  if (newState === true) {
    clearPlot();
    atlChartFilterStore.resetClearScatterPlotFlag();
  }
}, { deep: true });


async function changedYValues() {
  debouncedFetchScatterOptions();
}

watch(() => atlChartFilterStore.getReqId(), async (newReqId) => {
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

const symbolSizeSelection = () => {
    clearPlot();
    debouncedFetchScatterOptions();
};

watch (() => selectedAtl03ColorMap, async (newColorMap, oldColorMap) => {    
    console.log('Atl03ColorMap changed from:', oldColorMap ,' to:', newColorMap);
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
  flex-direction: column;
  justify-content: center;
  align-items: left;
  margin: 0.5rem;
  padding: 1rem;
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
