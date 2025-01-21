<script setup lang="ts">
import { use } from "echarts/core"; 
import ToggleButton from "primevue/togglebutton";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useAtl03ColorMapStore } from "@/stores/atl03ColorMapStore";
import { useChartStore } from "@/stores/chartStore";
import { useRequestsStore } from '@/stores/requestsStore';
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext, initSymbolSize } from "@/utils/plotUtils";
import SrRunControl from "./SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { initDataBindingsToChartStore } from '@/utils/plotUtils';
import { useMapStore } from "@/stores/mapStore";
import { useReqParamsStore } from "@/stores/reqParamsStore";
import SrReqDisplay from '@/components/SrReqDisplay.vue';
import SrPlotCntrl from "./SrPlotCntrl.vue";

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
const computedReqIdStr = computed<string>(() => atlChartFilterStore.selectedReqIdMenuItem.value.toString());
const loadingComponent = ref(true);
const computedFunc = computed(() => chartStore.getFunc(computedReqIdStr.value));

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);



// async function onOverlayYDataSelectionChange(thisoverlayedReqId: string | number, newValue: string[]) {
//     console.log(`Overlay Y Data for ${thisoverlayedReqId} changed:`, newValue);
//     await callPlotUpdateDebounced('from onOverlayYDataSelectionChange');
// }



onMounted(async () => {
    try {
        //console.log('SrScatterPlot onMounted');
        atl03ColorMapStore.initializeAtl03ColorMapStore();
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');
        atlChartFilterStore.showPhotonCloud = false;
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        const reqId = props.startingReqId;
        atlChartFilterStore.reqIdMenuItems =  await requestsStore.getMenuItems();
        initDataBindingsToChartStore(atlChartFilterStore.reqIdMenuItems.map(item => item.value.toString()));
        if (reqId > 0) {
            //const func = await indexedDb.getFunc(reqId);
            await initSymbolSize(reqId);
            await prepareDbForReqId(reqId);                                                                      
    
            // if (func === 'atl03sp') {
            //     atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
            // } else if (func.includes('atl06')) {
            //     atl03ColorMapStore.setAtl03ColorKey('YAPC');
            // } else if (func.includes('atl08')) {
            //     atl03ColorMapStore.setAtl03ColorKey('atl08_class');
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
                    initDataBindingsToChartStore([thisReqIdStr]);//after run gives us a reqId
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


// const symbolSizeSelection = async () => {
//     console.log('symbolSizeSelection');
//     await callPlotUpdateDebounced('symbolSizeSelection');
// };

// async function updateThePlot(msg:string) {
//     if(!loadingComponent.value){
//         await callPlotUpdateDebounced(msg);
//     } else {
//         console.warn(`Skipped updateThePlot for ${msg} - Loading component is still active`);
//     }
// }

watch(
  () => ({
    scOrients: chartStore.getScOrients(computedReqIdStr.value),
    rgts: chartStore.getRgts(computedReqIdStr.value),
    cycles: chartStore.getCycles(computedReqIdStr.value),
    spots: chartStore.getSpots(computedReqIdStr.value),
    tracks: chartStore.getTracks(computedReqIdStr.value),
    pairs: chartStore.getPairs(computedReqIdStr.value),
    ydata: chartStore.getSelectedYData(computedReqIdStr.value),
    solidColor: chartStore.getSolidSymbolColor(computedReqIdStr.value),
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
        </div> 
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <div class="sr-run-control" v-if="!computedFunc.includes('atl03')">
                <ToggleButton 
                    class="sr-show-hide-button"
                    onLabel="Hide Atl03 Photons"
                    offLabel="Show Atl03 Photons"
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
                    <SrPlotCntrl :reqId="atlChartFilterStore.selectedReqIdMenuItem.value" />
                </div>
                <div class="sr-multiselect-col">
                    <div v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds">
                        <SrPlotCntrl :reqId="overlayedReqId" />   
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

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
.sr-legend-panel{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items:center;
}

.sr-run-control{
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: left;
    overflow-y: auto;
    overflow-x: auto;
    width: auto;
    min-width: 10rem;
}

.sr-show-hide-button {
    height: 3rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 8rem;
    background-color:var(--p-button-text-primary-color);
    color:black;
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
.sr-select-y-data {
    width: 100%;
    margin: 0.25rem;
}

.sr-multiselect-container {
    display: flex;
    flex-wrap: wrap; /* Allow items to wrap to the next line if needed */
    justify-content: space-between; /* Distribute items with equal spacing */
    align-items: flex-start; /* Align items at the start */
    width: 100%;
    margin: 0.25rem 0;
    gap: 1rem; /* Consistent spacing between items */
}

.sr-multiselect-col {
    flex: 1 1 45%; /* Allow columns to take up 45% of the container width */
    min-width: 18rem; /* 300px equivalent */
    max-width: 32rem; /* 500px equivalent */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch; /* Stretch items to match the width */
    margin: 0.25rem;
}

fieldset {
    word-wrap: break-word; /* Break long words */
    white-space: normal; /* Allow wrapping */
}

@media (max-width: 48rem) { /* 768px equivalent */
    .sr-multiselect-col {
        flex: 1 1 100%; /* Take up full width on small screens */
        margin: 0.5rem 0;
    }
}

.sr-ydata-menu {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Align content to the left */
    gap: 0.5rem; /* Add spacing between elements */
    width: auto; /* Let the container size itself based on the content */
    padding: 0.5rem; /* Optional: Add some padding for spacing */
}
.sr-y-data-label {
    margin: 0;
    font-size: small;
}

.sr-color-selection-panel{
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
}

.color-preview {
    width: 1rem;
    height: 1rem;
    margin: 0.5rem;
    border: 1px solid var(--p-border-color);
    border-radius: 2px;
}

.sr-select-col-encode-data,
.sr-select-y-data {
    width: 100%;
    margin: 0.25rem;
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
