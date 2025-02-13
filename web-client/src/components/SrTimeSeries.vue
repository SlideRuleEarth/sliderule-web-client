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
import SrRunControl from "@/components/SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { initDataBindingsToChartStore } from '@/utils/plotUtils';
import { useMapStore } from "@/stores/mapStore";
import { useRecTreeStore } from "@/stores/recTreeStore";
import SrPlotCntrl from "./SrPlotCntrl.vue";
import { useAutoReqParamsStore } from "@/stores/reqParamsStore";
import SrPlotLegendBox from "./SrPlotLegendBox.vue";
import SrReqDisplay from "./SrReqDisplay.vue";
import { getAllCycleOptionsByRgtsSpotsAndGts,prepareDbForReqId } from "@/utils/SrDuckDbUtils";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import SrAlt08Colors from "@/components/SrAtl08Colors.vue";
import SrAtl03CnfColors from "@/components/SrAtl03CnfColors.vue";
import { selectedCycleReactive } from "@/utils/plotUtils";
import Listbox from 'primevue/listbox';



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


const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
});

const computedFilteredInCycleOptions = computed(() => {
    return globalChartStore.getFilteredCycleOptions();
});

const shouldDisplayAtl03Colors = computed(() => {
    let shouldDisplay = false;
    if(recTreeStore.findApiForReqId(recTreeStore.selectedReqId) === 'atl03sp'){
        shouldDisplay = true;
    } else {
        if(atlChartFilterStore.selectedOverlayedReqIds.length > 0){
            const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString();
            if(reqIdStr){
                shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl03_cnf';
            }
        }
    }
    return shouldDisplay;
});
const shouldDisplayAtl08Colors = computed(() => {
    let shouldDisplay = false;
    if(recTreeStore.findApiForReqId(recTreeStore.selectedReqId).includes('atl08')){
        shouldDisplay = true;
    } else {
        if(atlChartFilterStore.selectedOverlayedReqIds.length > 0){
            const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString();
            if(reqIdStr){
                shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl08_class';
            }
        }
    }
    return shouldDisplay;
});

const computedDataKey = computed(() => {
    return chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr);
});

const filterGood = computed(() => {
    return ((globalChartStore.getCycles().length === 1) && (globalChartStore.getRgts().length === 1) && (globalChartStore.getSpots().length === 1));
});

const enableThePhotonCloud = computed(() => {
    return (!useMapStore().getIsLoading() && filterGood.value);
}); 

const photonCloudBtnTooltip = computed(() => {
    if(!filterGood.value){
        return 'Photon Cloud is disabled due to multiple Cycles, Rgts, Spots, or Gts';
    } else {
        if(useMapStore().getIsLoading()){
            return 'Photon Cloud is disabled while record is loading';
        } else {
            //return  atlChartFilterStore.showPhotonCloud  ? 'Click to hide photon cloud':'Click to show atl03 photon cloud';
            return '';
        }
    }

});

onMounted(async () => {
    try {
        //console.log('SrTimeSeries onMounted');
        console.log('SrTimeSeries onMounted',!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported

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
            await useAutoReqParamsStore().presetForScatterPlotOverlay(reqId);
        } else {
            console.warn('reqId is undefined');
        }        
        //console.log('SrTimeSeries onMounted completed');
    } catch (error) {
            console.error('Error during onMounted initialization:', error);
    } finally {
        loadingComponent.value = false;
    }
});

watch(() => recTreeStore.selectedReqId, async (newReqId) => {
    console.log('SrTimeSeries watch reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        // this is just to preset certain values that the user never changes
        await useAutoReqParamsStore().presetForScatterPlotOverlay(newReqId);
        await callPlotUpdateDebounced('from SrTimeSeries watch recTreeStore.selectedReqId');
    }
});

watch(() => plotRef.value, async (newPlotRef) => {
    //console.log('plotRef changed:', newPlotRef);
    if (newPlotRef) {
        console.warn('SrTimeSeries watch plotRef changed:', newPlotRef);
        atlChartFilterStore.setPlotRef(plotRef.value);
        if(chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0){
            await callPlotUpdateDebounced('from SrTimeSeries watch plotRef.value');
        } else {
            console.warn('SrTimeSeries watch plotRef.value - no Y data selected');
        }
    }
});

const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !atlChartFilterStore.getIsWarning(),
    'message-yellow': atlChartFilterStore.getIsWarning()
  };
});

watch (() => atlChartFilterStore.showPhotonCloud, async (newShowPhotonCloud, oldShowPhotonCloud) => {
    console.log('SrTimeSeries showPhotonCloud changed from:', oldShowPhotonCloud ,' to:', newShowPhotonCloud);
    if(!loadingComponent.value){
        if(newShowPhotonCloud){
            const runContext = await getPhotonOverlayRunContext();
            if(runContext.reqId <= 0){ // need to fetch the data
                //console.log('showPhotonCloud runContext.reqId:', runContext.reqId, ' runContext.parentReqId:', runContext.parentReqId, 'runContext.trackFilter:', runContext.trackFilter);  
                await useAutoReqParamsStore().presetForScatterPlotOverlay(runContext.parentReqId);
                await processRunSlideRuleClicked(runContext); // worker is started here
                console.log('SrTimeSeries handlePhotonCloudChange - processRunSlideRuleClicked completed reqId:', runContext.reqId);
                if(runContext.reqId > 0){
                    const thisReqIdStr = runContext.reqId.toString();
                    initDataBindingsToChartStore([thisReqIdStr]);//after run gives us a reqId
                    await initSymbolSize(runContext.reqId);
                    initializeColorEncoding(runContext.reqId);
                } else { // request was successfully processed
                    console.error('SrTimeSeries handlePhotonCloudChange - processRunSlideRuleClicked failed');
                }
            } else { // we already have the data
                await initSymbolSize(runContext.reqId);
                initializeColorEncoding(runContext.reqId);
                await prepareDbForReqId(runContext.reqId);            
                await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
            }
            const msg = `Click 'Hide Photon Cloud Overlay' to remove highlighted track Photon Cloud data from the plot`;
            requestsStore.setConsoleMsg(msg);
        } else {
            console.log('SrTimeSeries handlePhotonCloudChange - showPhotonCloud FALSE');
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE');
        }
    } else {
        console.warn(`SrTimeSeries Skipped handlePhotonCloudChange - Loading component is still active`);
    }
});

watch(() => {
    const reqId = recTreeStore.selectedReqId;

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
    };
}, async (newValues, oldValues) => {
    if((newValues.spots != oldValues.spots) || (newValues.rgts != oldValues.rgts) || (newValues.gts != oldValues.gts)){
        const gtsValues = newValues.gts.map((gts) => gts);
        const filteredCycleOptions = await getAllCycleOptionsByRgtsSpotsAndGts(recTreeStore.selectedReqId)
        globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
        console.log('SrTimeSeries watch selected filter stuff Rgts,Spots,Gts... changed:', newValues.rgts, newValues.spots,gtsValues);
        atlChartFilterStore.setShowPhotonCloud(false);
    }
    if (!loadingComponent.value) {
        // if we have selected Y data and anything changes update the plot
        await callPlotUpdateDebounced('SrTimeSeries watch filter parms changed');
    } else {
        console.warn(
            `Skipped updateThePlot for watch filter parms - Loading component is still active`
        );
    }
});

watch(() => {
    const reqId = recTreeStore.selectedReqId;
    const reqIdStr = recTreeStore.selectedReqIdStr;

    // If reqId is undefined, null, or empty, return default values
    if (!reqId || reqId <= 0) {
        return {
            ydata: [],
            solidColor: null,
        };
    }

    // Otherwise, fetch the real values
    return {
        ydata: chartStore.getSelectedYData(reqIdStr),
        solidColor: chartStore.getSolidSymbolColor(reqIdStr),
    };
  },
  async (newValues, oldValues) => {
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
    console.log('SrTimeSeries handleValueChange:', value);
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
    } else {
        console.warn('reqId is undefined');
    }
    console.log('SrTimeSeries handleValueChange:', value);
}

</script>
<template>
    <div class="sr-time-series-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-time-series-container" v-else>
        <div class="sr-time-series-content">
            <v-chart  ref="plotRef" 
                class="time-series-chart" 
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
                <div class="sr-select-box">
                    <p class="sr-select-box-hdr">Cycles</p>
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
                    </Listbox>
                </div>
                <div class="sr-legends-panel">
                    <SrPlotLegendBox
                        v-if = "(computedDataKey!='solid')"
                        :reqIdStr="recTreeStore.selectedReqIdStr" 
                        :data_key="computedDataKey" 
                        :transparentBackground="false" 
                    />
                    <SrAlt08Colors  v-if="shouldDisplayAtl08Colors"/>
                    <SrAtl03CnfColors v-if="shouldDisplayAtl03Colors" />
                </div>
            </div>
        </div> 
        <div class="sr-time-series-cntrl">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <div class="sr-run-control" v-if="!recTreeStore.selectedApi?.includes('atl03')">
                <ToggleButton 
                    class="sr-show-hide-button"
                    onLabel="Hide Atl03 Photons"
                    offLabel="Show Atl03 Photons"
                    v-model="atlChartFilterStore.showPhotonCloud"
                    :disabled="!enableThePhotonCloud"
                    size="small" 
                    rounded
                    v-tooltip.top="photonCloudBtnTooltip"
                />
                <SrRunControl 
                    :includeAdvToggle="false"
                    buttonLabel="Photon Cloud"
                />
            </div>
            <!-- <div>
                {{ !useMapStore().getIsLoading()}}
                {{globalChartStore.getCycles().length}}
                {{globalChartStore.getRgts().length }}
                {{globalChartStore.getSpots().length }}
            </div> -->
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

.sr-time-series-container {
  display: block;
}

.time-series-chart{
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

.sr-time-series-cntrl {
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
.sr-time-series-content {
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
.sr-legends-panel{
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
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
    justify-content:center;
    align-items:flex-start;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
    max-width: 10rem;
}
.sr-select-boxes {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
}
.sr-select-box-hdr{
    display: flex;
    justify-content:center;
    align-items:center;
    margin: 0.25rem;
    padding: 0.25rem;
    width: auto;
    max-width: 10rem;
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
  padding: 0.25rem;
}

:deep(.p-listbox-header) {
    padding: 0.125rem;
    margin: 0.125rem;
    text-align: center;
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

.time-series-chart {
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  max-height: 50rem;
  max-width: 80rem;
}

</style>
