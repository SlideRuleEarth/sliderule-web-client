<template>
    <div class="sr-scatter-plot-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-scatter-plot-container" v-else>
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
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <div class="sr-run-control" v-if="!computedFunc.includes('atl03')">
                <ToggleButton 
                    class="sr-show-hide-button"
                    onLabel="Hide Photon Cloud"
                    offLabel="Show Photon Cloud"
                    v-model="atlChartFilterStore.showPhotonCloud"
                    :disabled="useMapStore().isLoading"
                    size="small" 
                    rounded
                />
                <SrRunControl 
                    :includeAdvToggle="false"
                    buttonLabel="Photon Cloud"
                />
            </div>
            <div>
                <SrReqDisplay checkboxLabel="Show request parameters for Overlayed Photon Cloud" />
            </div>
            <div class="sr-multiselect-container">

                <div class= "sr-multiselect-col">
                    <Fieldset :legend="findReqMenuLabel(atlChartFilterStore.selectedReqIdMenuItem.value)">
                        <MultiSelect
                                class="sr-multiselect"
                                :placeholder="`Y data for ${findReqMenuLabel(atlChartFilterStore.selectedReqIdMenuItem.value)}`"
                                :id="computedElID"
                                v-model="yDataBindingsReactive[computedReqIdStr]"
                                size="small" 
                                :options="useChartStore().getElevationDataOptions(computedReqIdStr)"
                                display="chip"
                                @update:modelValue="onMainYDataSelectionChange"
                        />
                        <SrSymbolSize
                            :reqIdStr="computedReqIdStr"
                            @update:symbolSize="handleSymbolSizeUpdate"
                        />
                    </Fieldset>
                </div>
                <div class="sr-multiselect-col">
                    <div v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds">
                        <div class= "sr-multiselect-col">
                            <Fieldset :legend="getOverlayedReqLegend(overlayedReqId)">
                                <MultiSelect
                                        class="sr-multiselect" 
                                        :placeholder="`Y data for ${findReqMenuLabel(overlayedReqId)}`"
                                        :id="`srMultiId-${overlayedReqId}`"
                                        v-model="yDataBindingsReactive[overlayedReqId.toString()]"
                                        size="small"
                                        :options="useChartStore().getElevationDataOptions(overlayedReqId.toString())"
                                        display="chip"
                                        @update:modelValue="(newValue) => onOverlayYDataSelectionChange(overlayedReqId, newValue)"
                                />
                                <SrSymbolSize
                                    :reqIdStr="overlayedReqId.toString()"
                                    @update:symbolSize="handleSymbolSizeUpdate"
                                />
                        </Fieldset>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { debounce } from 'lodash-es';
import MultiSelect from "primevue/multiselect";
import FloatLabel from "primevue/floatlabel";
import ToggleButton from "primevue/togglebutton";
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
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext, initSymbolSize } from "@/utils/plotUtils";
import SrRunControl from "./SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { findReqMenuLabel } from '@/utils/plotUtils';
import { useMapStore } from "@/stores/mapStore";
import Fieldset from "primevue/fieldset";
import { useReqParamsStore } from "@/stores/reqParamsStore";
import SrReqDisplay from '@/components/SrReqDisplay.vue';
import SrSymbolSize from '@/components/SrSymbolSize.vue';

const props = defineProps({
    startingReqId: {
        type:Number, 
        default:0
    }
});

const requestsStore = useRequestsStore();
const chartStore = useChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const reqParamsStore = useReqParamsStore();

const computedReqIdStr = computed(() => atlChartFilterStore.selectedReqIdMenuItem.value.toString());
const computedFunc = computed(() => chartStore.getFunc(computedReqIdStr.value));
const computedElID = computed(() => `srMultiId-${computedReqIdStr.value}`);
const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
const loadingComponent = ref(true);
const setSymbolCounter = ref(0);

function getOverlayedReqLegend(overlayedReqId: number): string {
    const label = findReqMenuLabel(overlayedReqId);
    return `${label} - Photon Cloud`;
}

async function handleSymbolSizeUpdate(newValue: number) {
    console.log('Symbol size updated to:', newValue);
    await callPlotUpdateDebounced('from handleSymbolSizeUpdate');
}

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
    console.log("Main Y Data changed:", newValue);
    await callPlotUpdateDebounced('from onMainYDataSelectionChange');
}

async function onOverlayYDataSelectionChange(thisoverlayedReqId: string | number, newValue: string[]) {
    console.log(`Overlay Y Data for ${thisoverlayedReqId} changed:`, newValue);
    await callPlotUpdateDebounced('from onOverlayYDataSelectionChange');
}

onMounted(async () => {
    try {
        //console.log('SrScatterPlot onMounted');
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');
        atlChartFilterStore.showPhotonCloud = false;
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        const reqId = props.startingReqId;
        atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
        initializeBindings(atlChartFilterStore.reqIdMenuItems.map(item => item.value.toString()));
        if (reqId > 0) {
            const func = await indexedDb.getFunc(reqId);
            await initSymbolSize(reqId);
            atl03ColorMapStore.initializeAtl03ColorMapStore();
            await prepareDbForReqId(reqId);                                                                      
    
            if (func === 'atl03sp') {
                atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
            } else if (func.includes('atl06')) {
                atl03ColorMapStore.setAtl03ColorKey('YAPC');
            } else if (func.includes('atl08')) {
                atl03ColorMapStore.setAtl03ColorKey('atl08_class');
            }
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
        await prepareDbForReqId(newReqId);
        await callPlotUpdateDebounced('from watch atlChartFilterStore.getReqId()');
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
    } else {
        console.warn('watch computedSelectedAtl03ColorMap reqId is undefined');
    }
}, { deep: true, immediate: true });


watch (() => atlChartFilterStore.showPhotonCloud, async (newShowPhotonCloud, oldShowPhotonCloud) => {
    console.log('showPhotonCloud changed from:', oldShowPhotonCloud ,' to:', newShowPhotonCloud);
    if(!loadingComponent.value){
        if(newShowPhotonCloud){
            const runContext = await getPhotonOverlayRunContext();
            if(runContext.reqId <= 0){
                //console.log('showPhotonCloud runContext.reqId:', runContext.reqId, ' runContext.parentReqId:', runContext.parentReqId, 'runContext.trackFilter:', runContext.trackFilter);  
                await reqParamsStore.presetForScatterPlotOverlay(runContext.parentReqId);
                await processRunSlideRuleClicked(runContext);
                console.log('handlePhotonCloudChange - processRunSlideRuleClicked completed reqId:', runContext.reqId);
                if(runContext.reqId > 0){
                    const thisReqIdStr = runContext.reqId.toString();
                    const parentReqIdStr = runContext.parentReqId.toString();
                    initializeBindings([thisReqIdStr]);//after run gives us a reqId
                    await initSymbolSize(runContext.reqId);
                    atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
                    chartStore.setTracks(thisReqIdStr, chartStore.getTracks(parentReqIdStr));
                    chartStore.setBeams(thisReqIdStr, chartStore.getBeams(parentReqIdStr));
                    chartStore.setRgts(thisReqIdStr, chartStore.getRgts(parentReqIdStr));
                    chartStore.setCycles(thisReqIdStr, chartStore.getCycles(parentReqIdStr));
                } else {
                    console.error('handlePhotonCloudChange - processRunSlideRuleClicked failed');
                }
            } else {
                await initSymbolSize(runContext.reqId);
                await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
            }
            const msg = `Click 'Hide Photon Cloud Overlay' to remove highlighted track Photon Cloud data from the plot`;
            requestsStore.setConsoleMsg(msg);
        } else {
            console.log('handlePhotonCloudChange - showPhotonCloud FALSE');
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE');
        }
    } else {
        console.warn(`Skipped handlePhotonCloudChange - Loading component is still active`);
    }
}, { deep: true, immediate: true });


watch(atlChartFilterStore.selectedOverlayedReqIds, async (newSelection, oldSelection) => {
    console.log('watch selectedOverlayedReqIds --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
    } catch (error) {
        console.error('watch selectedOverlayedReqIds Failed to update selected request:', error);
    }
});

watch(atlChartFilterStore.selectedReqIdMenuItem, async (newSelection, oldSelection) => {
    //console.log('watch useAtlChartFilterStore().selectedReqIdMenuItem --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        console.log('watch selectedReqIdMenuItem --> Request ID changed from:', oldSelection ,' to:', newSelection);
    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});


const symbolSizeSelection = async () => {
    console.log('symbolSizeSelection');
    await callPlotUpdateDebounced('symbolSizeSelection');
};

async function updateThePlot(msg:string) {
    if(!loadingComponent.value){
        await callPlotUpdateDebounced(msg);
    } else {
        console.warn(`Skipped updateThePlot for ${msg} - Loading component is still active`);
    }
}

watch(
  () => ({
    scOrients: chartStore.getScOrients(computedReqIdStr.value),
    rgts: chartStore.getRgts(computedReqIdStr.value),
    cycles: chartStore.getCycles(computedReqIdStr.value),
    spots: chartStore.getSpots(computedReqIdStr.value),
    tracks: chartStore.getTracks(computedReqIdStr.value),
    pairs: chartStore.getPairs(computedReqIdStr.value),
  }),
  async (newValues, oldValues) => {
    if(!loadingComponent.value){
        await callPlotUpdateDebounced('watch multiple properties changed');
    } else {
        console.warn(`Skipped updateThePlot for watch multiple properties - Loading component is still active`);
    }  
  },
  { deep: true }
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
.sr-run-control{
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: left;
    overflow-y: auto;
    overflow-x: auto;
    width: auto;
}

.sr-show-hide-button {
    height: 3rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
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
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    width: 100%;
    margin: 0.25rem;
    border: 0.25rem;
    margin-top: 2.0rem;
}

.sr-multiselect-col {
    display: flex;
    flex-direction: column;
    justify-content: left;
    align-items: left;
    width: 100%;
    margin: 0.25rem;
    margin-top: 0rem;
    margin-left: 1rem;
    border: 0.25rem;
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

.sr-overlayed-reqs-ss {
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 1rem;
  border: 0.5rem;
}

.sr-scatter-checkbox-slider {
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items:center;
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
