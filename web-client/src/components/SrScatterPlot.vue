<script setup lang="ts">
import { use } from "echarts/core"; 
import ToggleButton from "primevue/togglebutton";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useColorMapStore } from "@/stores/colorMapStore";
import { useChartStore } from "@/stores/chartStore";
import { useRequestsStore } from '@/stores/requestsStore';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext, initializeColorEncoding, initSymbolSize } from "@/utils/plotUtils";
import SrRunControl from "./SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { initDataBindingsToChartStore } from '@/utils/plotUtils';
import { useMapStore } from "@/stores/mapStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import SrPlotCntrl from "./SrPlotCntrl.vue";
import { useAutoReqParamsStore } from "@/stores/reqParamsStore";
import { selectedRgtsReactive,selectedCycleReactive } from "@/utils/plotUtils";
import Listbox from 'primevue/listbox';
import SrLegendBox from "./SrLegendBox.vue";
import SrReqDisplay from "./SrReqDisplay.vue";
import SrBeamPattern from "./SrBeamPattern.vue";
import { getAllCycleOptionsByRgtsSpotsAndGts, prepareDbForReqId } from "@/utils/SrDuckDbUtils";
import { useGlobalChartStore } from "@/stores/globalChartStore";

const props = defineProps({
    startingReqId: {
        type:Number, 
        default:0
    }
});

const requestsStore = useRequestsStore();
const chartStore = useChartStore();
const globalChartStore = useGlobalChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const colorMapStore = useColorMapStore();
const recTreeStore = useRecTreeStore();
const loadingComponent = ref(true);

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);

const computedRgtOptions = computed(() => {
    const rgtOptions= globalChartStore.getRgtOptions();
    console.log('SrScatterPlot computedRgtOptions:',rgtOptions);
    return rgtOptions;
});

const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
});

const computedFilteredInCycleOptions = computed(() => {
    return globalChartStore.getFilteredCycleOptions();
});

const allowedCycleValues = computed(() => {
    return new Set(computedFilteredInCycleOptions.value.map(option => option.value));
});

const computedDataKey = computed(() => {
    return chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr);
});

onMounted(async () => {
    try {
        //console.log('SrScatterPlot onMounted');
        console.log('SrScatterPlot onMounted',!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported

        colorMapStore.initializeColorMapStore();
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');
        atlChartFilterStore.showPhotonCloud = false;
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        const reqId = props.startingReqId;
        if (reqId > 0) {
            await initSymbolSize(reqId);
            initializeColorEncoding(reqId);
            // set this so if the user looks at it, it will be there
            await useAutoReqParamsStore().initForScatterPlotOverlay(reqId);
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

watch(() => recTreeStore.selectedReqId, async (newReqId) => {
    console.log('SrScatterPlot watch reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        // this is just to preset certain values that the user never changes
        await useAutoReqParamsStore().initForScatterPlotOverlay(newReqId);
        await callPlotUpdateDebounced('from SrScatterPlot watch recTreeStore.selectedReqId');
    }
});

watch(() => plotRef.value, async (newPlotRef) => {
    //console.log('plotRef changed:', newPlotRef);
    if (newPlotRef) {
        console.warn('SrScatterPlot watch plotRef changed:', newPlotRef);
        atlChartFilterStore.setPlotRef(plotRef.value);
        await callPlotUpdateDebounced('from SrScatterPlot watch plotRef.value');
    }
});

const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !atlChartFilterStore.getIsWarning(),
    'message-yellow': atlChartFilterStore.getIsWarning()
  };
});

async function getDataForRgtCycle(rgt:number,cycle:number):Promise<void> {
    console.log('SrScatterPlot getDataForRgtCycle rgt:',rgt,'cycle:', cycle);
    const runContext = await getPhotonOverlayRunContext(rgt,cycle);
    const parentReqIdStr = runContext.parentReqId.toString();
    if(runContext.reqId <= 0){
        //console.log('getDataForRgtCycle runContext.reqId:', runContext.reqId, ' runContext.parentReqId:', runContext.parentReqId, 'runContext.trackFilter:', runContext.trackFilter); 
        await useAutoReqParamsStore().presetForScatterPlotOverlay(runContext.parentReqId,rgt,cycle);
        await processRunSlideRuleClicked(runContext);
        console.log('SrScatterPlot handlePhotonCloudChange - processRunSlideRuleClicked completed reqId:', runContext.reqId);
        if(runContext.reqId <= 0){ // request was successfully processed
            console.error('SrScatterPlot handlePhotonCloudChange - processRunSlideRuleClicked failed');
        }
    } else {
        console.log('SrScatterPlot handlePhotonCloudChange - processRunSlideRuleClicked skipped - reqId already exists');
    }
    const thisReqIdStr = runContext.reqId.toString();
    initDataBindingsToChartStore([thisReqIdStr]);//after run gives us a reqId
    await initSymbolSize(runContext.reqId);
    initializeColorEncoding(runContext.reqId);
    await prepareDbForReqId(runContext.reqId);
    globalChartStore.appendToSelectedCycleOptions(cycle);
    atlChartFilterStore.appendToSelectedOverlayedReqIds(runContext.reqId);
}

watch (() => atlChartFilterStore.showPhotonCloud, async (newShowPhotonCloud, oldShowPhotonCloud) => {
    console.log('SrScatterPlot showPhotonCloud changed from:', oldShowPhotonCloud ,' to:', newShowPhotonCloud);
    if(!loadingComponent.value){
        if(newShowPhotonCloud){
            globalChartStore.getRgts().forEach(async (rgt) => {
                globalChartStore.getCycles().forEach(async (cycle) => {
                    await getDataForRgtCycle(rgt,cycle);
                });
            });
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
            const msg = `Click 'Hide Photon Cloud Overlay' to remove highlighted track Photon Cloud data from the plot`;
            requestsStore.setConsoleMsg(msg);
        } else {
            console.log('SrScatterPlot handlePhotonCloudChange - showPhotonCloud FALSE');
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE');
        }
    } else {
        console.warn(`SrScatterPlot Skipped handlePhotonCloudChange - Loading component is still active`);
    }
});


watch(atlChartFilterStore.selectedOverlayedReqIds, async (newSelection, oldSelection) => {
    console.log('watch selectedOverlayedReqIds --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        //atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
    } catch (error) {
        console.error('watch selectedOverlayedReqIds Failed to update selected request:', error);
    }
});


watch(
  () => {
    const reqId = recTreeStore.selectedReqId;
    const reqIdStr = recTreeStore.selectedReqIdStr;

    // If reqId is undefined, null, or empty, return default values
    if (!reqId || reqId <= 0) {
        return {
            scOrients: globalChartStore.getScOrients(),
            rgts: globalChartStore.getRgts(),
            cycles: globalChartStore.getCycles(),
            spots: globalChartStore.getSpots(),
            gts: globalChartStore.getGts(),
            tracks: globalChartStore.getTracks(),
            pairs: globalChartStore.getSelectedPairOptions(),
            ydata: [],
            solidColor: null,
        };
    }

    // Otherwise, fetch the real values
    return {
        scOrients: globalChartStore.getScOrients(),
        rgts: globalChartStore.getRgts(),
        cycles: globalChartStore.getCycles(),
        spots: globalChartStore.getSpots(),
        gts: globalChartStore.getGts(),
        tracks: globalChartStore.getTracks(),
        pairs: globalChartStore.getSelectedPairOptions(),
        ydata: chartStore.getSelectedYData(reqIdStr),
        solidColor: chartStore.getSolidSymbolColor(reqIdStr),
    };
  },
  async (newValues, oldValues) => {
    if((newValues.spots != oldValues.spots) || (newValues.rgts != oldValues.rgts) || (newValues.gts != oldValues.gts)){
        const gtsValues = newValues.gts.map((gts) => gts);
        const filteredCycleOptions = await getAllCycleOptionsByRgtsSpotsAndGts(recTreeStore.selectedReqId,newValues.rgts,newValues.spots,gtsValues)
        globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
        console.log('SrScatterPlot watch selected Rgts,Spots,Gts changed:', newValues.rgts, newValues.spots,gtsValues);
    }
    let needPlotUpdate = false;
    if (!loadingComponent.value) {
         // if we have selected Y data and anything changes update the plot
        if(newValues.ydata.length > 0){
            needPlotUpdate = true;
        } else {
            console.warn(`Skipped updateThePlot for watch selected Y data - Loading component is still active`);
        }       
        if(needPlotUpdate){
            await callPlotUpdateDebounced('from watch selected Y data changed');
        }
    } else {
      console.warn(
        `Skipped updateThePlot for watch multiple properties - Loading component is still active`
      );
    }
  },
  { deep: true }
);

function handleValueChange(value) {
    console.log('SrScatterPlot handleValueChange:', value);
    atlChartFilterStore.setSelectedOverlayedReqIds([]);
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        //callPlotUpdateDebounced('from handleModelValueChange');
    } else {
        console.warn('reqId is undefined');
    }
    console.log('SrScatterPlot handleValueChange:', value);
}

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
            <div class="sr-cycles-legend-panel">
                <SrLegendBox
                    v-if = "(computedDataKey!='solid')"
                    :reqIdStr="recTreeStore.selectedReqIdStr" 
                    :data_key="computedDataKey" 
                    :transparentBackground="false" 
                />
                <div class="sr-select-boxes">
                    <Listbox 
                        class="sr-select-lists"
                        v-model="selectedRgtsReactive[recTreeStore.selectedReqIdStr]" 
                        optionLabel="label"
                        optionValue="value"
                        :multiple="true"
                        :metaKeySelection="true"
                        :options="computedRgtOptions"
                        @change="handleValueChange"
                    >
                        <template #header>
                            <div class="p-listbox-header">
                                <div class="sr-listbox-header-title">
                                    <span>Rgts</span>
                                </div>
                            </div>
                        </template>
                    </Listbox>
                    <Listbox 
                        class="sr-select-lists"
                        v-model="selectedCycleReactive[recTreeStore.selectedReqIdStr]" 
                        optionLabel="label"
                        optionValue="value"
                        :multiple="true"
                        :metaKeySelection="true"
                        :options="computedCycleOptions"
                        @change="handleValueChange"
                    >
                        <template #header>
                            <div class="p-listbox-header">
                                <div class="sr-listbox-header-title">
                                    <span>Cycles {{ allowedCycleValues.size }}/{{ computedCycleOptions.length }}</span>
                                </div>
                            </div>
                        </template>
                    </Listbox>
                    </div>
                <SrBeamPattern :reqIdStr="recTreeStore.selectedReqIdStr"/>
             </div>
        </div> 
        <div class="sr-scatter-plot-cntrl">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <div class="sr-run-control" v-if="!recTreeStore.selectedApi?.includes('atl03')">
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
            <div class="sr-multiselect-container">

                <div class= "sr-multiselect-col">
                    <SrPlotCntrl
                        v-if="(recTreeStore.selectedReqId > 0)"
                        :reqId="recTreeStore.selectedReqId" 
                    />
                </div>
                <div class="sr-multiselect-col">
                    <div v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds" :key="overlayedReqId">
                        <SrPlotCntrl :reqId="overlayedReqId" :isOverlay="true" />   
                    </div>
                </div>
                <div class="sr-multiselect-col-req">
                    <SrReqDisplay
                    v-if="(atlChartFilterStore.selectedOverlayedReqIds.length === 0)"
                        checkboxLabel='Show Photon Cloud Req Params'
                        :isForPhotonCloud="true"
                        :tooltipText="'The params that will be used for the Photon Cloud overlay'"
                    />
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

.sr-scatter-plot-cntrl {
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
.sr-cycles-legend-panel{
    display: flex;
    flex-direction: column;
    justify-content:space-between;
    align-items:center;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
}
.sr-select-lists {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
    max-width: 10rem;
}
.sr-select-boxes {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
}

:deep(.sr-listbox-header-title) {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin: 0.25rem;
    padding: 0.25rem;
    font-weight: bold;
    color: var(--p-text-color);
    border-radius: var(--p-border-radius);
}
:deep(.p-listbox-list-container) {
    width: 100%;
    min-width: 5rem;
    max-width: 16rem;
    max-height: 10rem;
    margin: 0.25rem;
}
:deep(.p-listbox-option) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.p-listbox-header) {
    padding: 0.125rem;
    margin: 0.125rem;
}



:deep(.p-listbox-list-wrapper) {
  /* A fixed width or max-width is usually necessary to force scrolling */
  max-width: 20rem;       
  /* or use width: 300px; if you prefer a fixed width */

  overflow-x: auto;       /* enable horizontal scrolling */
  white-space: nowrap;    /* prevent list items from wrapping to the next line */
}

/* Ensure list items stay side-by-side horizontally */
:deep(.p-listbox-list) {
  display: inline-flex;    /* horizontally place <li> elements in a row */
  flex-wrap: nowrap;       /* no wrapping */
  padding: 0;              /* optional, just to reduce default padding */
  margin: 0;               /* optional, just to reduce default margin */
}

:deep(.p-listbox-item) {
  /* Each item should not flex to fill the container, so prevent auto stretching: */
  flex: 0 0 auto; 
  /* Or use: display: inline-block; */
  white-space: nowrap;  /* Make sure each item’s text doesn’t wrap within itself */
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
    justify-content: flex-start; /* All items are packed toward the start of the main axis */
    align-items: flex-start; /* Align items at the start */
    width: 100%;
    margin: 0.25rem 0;
    gap: 1rem; /* Consistent spacing between items */
}

.sr-multiselect-col {
    flex: 1 1 45%; /* Allow columns to take up 45% of the container width */
    min-width: 10rem; /* 300px equivalent */
    max-width: 16rem; /* 500px equivalent */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch; /* Stretch items to match the width */
    margin: 0.25rem;
}

.sr-multiselect-col-req {
    flex: 1 1 45%; /* Allow columns to take up 45% of the container width */
    min-width: 10rem; /* 300px equivalent */
    max-width: 25rem; /* 500px equivalent */
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
