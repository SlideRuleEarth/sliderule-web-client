<template>
    <div class="sr-scatter-plot-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-scatter-plot-container" v-else>
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <div class="sr-multiselect-container">
                <FloatLabel variant="on">
                  <MultiSelect
                      class="sr-multiselect" 
                      :id="computedElID"
                      v-model="yDataBindingsReactive[computedReqIdStr]"
                      size="small" 
                      :options="useChartStore().getElevationDataOptions(computedReqIdStr)"
                      display="chip"
                      @update:modelValue="onMainYDataSelectionChange"
                  />
                  <label :for="computedElID"> {{ `Y Data for ${findReqMenuLabel(atlChartFilterStore.currentReqId)}` }}</label>
                </FloatLabel>
            </div>
            <div class="sr-overlayed-reqs" v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds">
                <FloatLabel variant="on">
                  <MultiSelect
                      class="sr-multiselect" 
                      :id="`srMultiId-${overlayedReqId}`"
                      v-model="yDataBindingsReactive[overlayedReqId]"
                      size="small"
                      :options="useChartStore().getElevationDataOptions(overlayedReqId.toString())"
                      display="chip"
                      @update:modelValue="(newValue) => onOverlayYDataSelectionChange(overlayedReqId, newValue)"
                  />
                    <label :for="`srMultiId-${overlayedReqId}`"> {{ `Y Data for ${overlayedReqId} -  ${chartStore.getFunc(overlayedReqId.toString())}`}}</label>
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
            <SrAtl03ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl03_cnf')   && ((chartStore.getFunc(computedReqIdStr) === 'atl03sp') || (atlChartFilterStore.getSelectedOverlayedReqIds().length>0)))" />
            <SrAtl08ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl08_class') && ((chartStore.getFunc(computedReqIdStr) === 'atl03sp') || (atlChartFilterStore.getSelectedOverlayedReqIds().length>0)))" />
        </div> 
        <!-- <div>       func:{{ computedFunc }}  </div>
        <div>  isLoading:{{ atlChartFilterStore.isLoading }}</div> 
        <div>currentRows:{{ mapStore.getCurrentRows() }}</div> -->
        <div class="sr-photon-cloud" v-if="!computedFunc.includes('atl03') && (!atlChartFilterStore.isLoading)">
          <SrCheckbox 
              label="Show Photon Cloud Overlay" 
              v-model="atlChartFilterStore.showPhotonCloud" 
          />
          <div sr-run-control>
                <SrRunControl 
                    :includeAdvToggle="false"
                    buttonLabel="Photon Cloud"
                    :inSensitive="(!atlChartFilterStore.showPhotonCloud || !mapStore.isLoading)"  
                />

            </div>
            <SrReqDisplay checkboxLabel="Show request parameters for Overlayed Photon Cloud" />
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
import type { WritableComputedRef } from "vue";
import { provide, watch, onMounted, ref, computed, reactive } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { useAtl03ColorMapStore } from "@/stores/atl03ColorMapStore";
import SrAtl03ColorLegend from "@/components/SrAtl03ColorLegend.vue";
import SrAtl08ColorLegend from "@/components/SrAtl08ColorLegend.vue";
import { useChartStore } from "@/stores/chartStore";
import { useRequestsStore } from '@/stores/requestsStore';
import SrReqDisplay from "./SrReqDisplay.vue";
import SrCheckbox from "./SrCheckbox.vue";
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext } from "@/utils/plotUtils";
import SrRunControl from "./SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { useMapStore } from '@/stores/mapStore';
import { initSymbolSize,findReqMenuLabel } from '@/utils/plotUtils';


const requestsStore = useRequestsStore();
const chartStore = useChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const mapStore = useMapStore();
const computedReqIdStr = computed(() => atlChartFilterStore.currentReqId.toString());
const computedFunc = computed(() => chartStore.getFunc(computedReqIdStr.value));
const computedElID = computed(() => `srMultiId-${computedReqIdStr.value}`);
const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
const loadingComponent = ref(true);

function initializeBindings(reqIds: string[]) {
    //console.log('initializeBindings:', reqIds);
    reqIds.forEach((reqId) => {
        if (!(reqId in yDataBindingsReactive)) {
            yDataBindingsReactive[reqId] = computed({
                get: () => chartStore.getYDataForChart(reqId),
                set: (value: string[]) => chartStore.setYDataForChart(reqId, value),
            });
        }
    });
}
use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);

async function onMainYDataSelectionChange(newValue: string[]) {
    //console.log("Main Y Data changed:", newValue);
    await callPlotUpdateDebounced('from onMainYDataSelectionChange');
}

async function onOverlayYDataSelectionChange(overlayedReqId: string | number, newValue: string[]) {
    console.log(`Overlay Y Data for ${overlayedReqId} changed:`, newValue);
    await callPlotUpdateDebounced('from onOverlayYDataSelectionChange');
}

onMounted(async () => {
    try {
        //console.log('SrScatterPlot onMounted');
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');

        const reqId = atlChartFilterStore.getReqId();
        atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
        initializeBindings(atlChartFilterStore.reqIdMenuItems.map(item => item.value));
        if (reqId > 0) {
            const func = await indexedDb.getFunc(reqId);
            atl03ColorMapStore.initializeAtl03ColorMapStore();
            await prepareDbForReqId(reqId);                                                                      
    
            if (func === 'atl03sp') {
                atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
            } else if (func.includes('atl06')) {
                atl03ColorMapStore.setAtl03ColorKey('YAPC');
            } else if (func.includes('atl08')) {
                atl03ColorMapStore.setAtl03ColorKey('atl08_class');
            }
            // Create a Set of reqIds values for quick lookup
            // const successfulReqIdsSet = new Set(atlChartFilterStore.reqIdMenuItems.map(item => Number(item.value)));
            // for (const oreqId of successfulReqIdsSet) { 
            //     prepareDbForReqId(oreqId);
            // }
        } else {
            console.warn('reqId is undefined');
        }
        
        //console.log('SrScatterPlot onMounted completed');
    } catch (error) {
            console.error('Error during onMounted initialization:', error);
    } finally {
        loadingComponent.value = false;
    }
});

watch(() => atlChartFilterStore.getReqId(), async (newReqId) => {
    console.log('reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        await callPlotUpdateDebounced('from watch atlChartFilterStore.getReqId()');
        await prepareDbForReqId(newReqId);
    }
});

watch(() => plotRef.value, async (newPlotRef) => {
    //console.log('plotRef changed:', newPlotRef);
    if (newPlotRef) {
        console.warn('plotRef changed:', newPlotRef);
        atlChartFilterStore.setPlotRef(plotRef.value);
        await callPlotUpdateDebounced('from watch plotRef.value');
    }
});

const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !atlChartFilterStore.getIsWarning(),
    'message-yellow': atlChartFilterStore.getIsWarning()
  };
});

const computedSelectedAtl03ColorMap = computed(() => {
  return atl03ColorMapStore.getSelectedAtl03YapcColorMapName();
});

watch (() => computedSelectedAtl03ColorMap, async (newColorMap, oldColorMap) => {    
    //console.log('Atl03ColorMap changed from:', oldColorMap ,' to:', newColorMap);
    atl03ColorMapStore.updateAtl03YapcColorMapValues();
    //console.log('Color Map:', atl03ColorMapStore.getAtl03YapcColorMap());
    const reqId = atlChartFilterStore.getReqId();
    if (reqId > 0) {
        await callPlotUpdateDebounced('from watch computedSelectedAtl03ColorMap');
    }
}, { deep: true, immediate: true });


watch (() => atlChartFilterStore.showPhotonCloud, async (newShowPhotonCloud, oldShowPhotonCloud) => {
    //console.log('showPhotonCloud changed from:', oldShowPhotonCloud ,' to:', newShowPhotonCloud);
    if(newShowPhotonCloud){
        const runContext = await getPhotonOverlayRunContext();
        if(runContext.reqId <= 0){
            await processRunSlideRuleClicked(runContext);
            console.log('handlePhotonCloudChange - processRunSlideRuleClicked completed reqId:', runContext.reqId);
            const thisReqIdStr = runContext.reqId.toString();
            initializeBindings([thisReqIdStr]);//after run gives us a reqId
            initSymbolSize(thisReqIdStr);
            atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
        } else {
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
        }
    } else {
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE');
    }
}, { deep: true, immediate: true });


watch(atlChartFilterStore.selectedOverlayedReqIds, async (newSelection, oldSelection) => {
    console.log('watch selectedOverlayedReqIds --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
   } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});


async function updateThePlot(msg:string) {
    if(!loadingComponent.value){
        await callPlotUpdateDebounced(msg);
    } else {
        console.warn('Skipped updateThePlot - Loading component is still active');
    }
}


watch(() => atlChartFilterStore.scOrients,
  async (newValues, oldValues) => {
    //console.log('watch - scOrients changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.scOrients");
  }
);

watch(() => atlChartFilterStore.rgts,
  async (newValues, oldValues) => {
    //console.log('watch - rgts changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.rgts");
  }
);

watch(() => atlChartFilterStore.cycles,
  async (newValues, oldValues) => {
    //console.log('watch - cycles changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.cycles");
  }
);

watch(() => atlChartFilterStore.spots,
  async (newValues, oldValues) => {
    //console.log('watch - spots changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.spots");
  }
);

watch(() => atlChartFilterStore.beams,
  async (newValues, oldValues) => {
    //console.log('watch - beams changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.beams");
  }
);

watch(() => atlChartFilterStore.tracks,
  async (newValues, oldValues) => {
    //console.log('watch - tracks changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.tracks");
  }
);

watch(() => atlChartFilterStore.pairs,
  async (newValues, oldValues) => {
    //console.log('watch - pairs changed from:', oldValues, 'to:', newValues);
    updateThePlot("watch atlChartFilterStore.pairs");
  }
);

</script>

<style scoped>

.sr-scatter-plot-container {
  display: block;
}

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

.sr-photon-cloud {
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

.sr-multiselect-container {
    width: 100%;
    margin: 1.5rem;
    margin-bottom: 2.0rem;
    border: 0.5rem;
}

.sr-overlayed-reqs {
    width: 100%;
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
    border-left: 0.5rem;
    border-bottom: 0.5rem;
}

.sr-multiselect {
    width: fit-content;
    margin: 0rem;
    border: 0rem;
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
