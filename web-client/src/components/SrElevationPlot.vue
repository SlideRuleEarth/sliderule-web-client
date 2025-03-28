<script setup lang="ts">
import { use } from "echarts/core"; 
import ToggleButton from "primevue/togglebutton";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent, ToolboxComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, onUnmounted, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { useRequestsStore } from '@/stores/requestsStore';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext, initializeColorEncoding, initSymbolSize,updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import SrRunControl from "@/components/SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import { initDataBindingsToChartStore } from '@/utils/plotUtils';
import { useRecTreeStore } from "@/stores/recTreeStore";
import SrPlotCntrl from "./SrPlotCntrl.vue";
import { useAutoReqParamsStore } from "@/stores/reqParamsStore";
import SrGradientLegend from "./SrGradientLegend.vue";
import SrSolidColorLegend from "./SrSolidColorLegend.vue";
import SrReqDisplay from "./SrReqDisplay.vue";
import { prepareDbForReqId } from "@/utils/SrDuckDbUtils";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { useAnalysisMapStore } from "@/stores/analysisMapStore";
import SrAtl03CnfColors from "@/components/SrAtl03CnfColors.vue";
import SrAtl08Colors from "@/components/SrAtl08Colors.vue";
import SrCustomTooltip from "@/components/SrCustomTooltip.vue";
import Dialog from 'primevue/dialog';
import { AppendToType } from "@/types/SrTypes";
import { processSelectedElPnt } from "@/utils/SrMapUtils";
import SrCycleSelect from "@/components/SrCycleSelect.vue";
import SrSimpleYatcCntrl from "./SrSimpleYatcCntrl.vue";
import ProgressSpinner from "primevue/progressspinner";
import Panel from 'primevue/panel';
import { useSymbolStore } from "@/stores/symbolStore";


const tooltipRef = ref();

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
const recTreeStore = useRecTreeStore();
const analysisMapStore = useAnalysisMapStore();
const loadingComponent = ref(true);
const dialogsInitialized = ref(false); // Track if dialogs have been initialized

use([
    CanvasRenderer, 
    ScatterChart, 
    TitleComponent, 
    TooltipComponent, 
    LegendComponent, 
    DataZoomComponent, 
    ToolboxComponent
]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);
const chartWrapperRef = ref<AppendToType>(undefined);
const webGLSupported = ref<boolean>(!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported
const chartReady = ref(false);

const mainLegendDialogStyle = ref<{
    position: string;
    top: string;
    left: string;
    transform?: string; // Optional property
}>({
    position: "absolute",
    top: "0px",
    left: "0px",
    transform: "translate(-50%, -50%)" // Initially set, removed on drag
});


const overlayLegendDialogStyle = ref<{
    position: string;
    top: string;
    left: string;
    transform?: string; // Optional property
}>({
    position: "absolute",
    top: "0px",
    left: "0px",
    transform: "translate(-50%, -50%)" // Initially set, removed on drag
});

const initMainLegendPosition = () => {
  const thisChartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
  if (thisChartWrapper) {
    const rect = thisChartWrapper.getBoundingClientRect();
    const rect_left = rect.left;
    const rect_top = rect.top;
    const rect_right = rect.right;
    const rect_bottom = rect.bottom;
    globalChartStore.scrollX = window.scrollX;
    globalChartStore.scrollY = window.scrollY;
    const windowScrollX = globalChartStore.scrollX;
    const windowScrollY = globalChartStore.scrollY;
    // Convert rem to pixels (1rem = 16px by default)
    const middleHorizontalOffset = rect.width / 2; // n rem from the left
    const middleX = rect.left + middleHorizontalOffset;
    const assumedTitleWidth = globalChartStore.titleOfElevationPlot.length * globalChartStore.fontSize;
    const endOfTitle = rect.left + middleHorizontalOffset + (assumedTitleWidth/2);
    const spaceSize = rect.right - endOfTitle; 
    const centerOfLegend = endOfTitle + (spaceSize/2);
    const assumedLegendWidth = assumedTitleWidth; // They are about the same cefgw 
    const leftLegendOffset = centerOfLegend - (assumedLegendWidth/2);
    const left = `${leftLegendOffset}px`; 

    const topOffset = 0.25 * globalChartStore.fontSize; // n rem from the top
    const top = `${rect.top + topOffset}px`; 

    // console.log('SrElevationPlot initMainLegendPosition:', {
    //     windowScrollX,
    //     windowScrollY,
    //     fontSize: globalChartStore.fontSize,
    //     topOffset,
    //     endOfTitle,
    //     middleHorizontalOffset,
    //     middleX,
    //     leftLegendOffset,        
    //     assumedTitleWidth,
    //     spaceSize,
    //     centerOfLegend,    
    //     top,
    //     left,
    //     rect_top,
    //     rect_left,
    //     rect_right,
    //     rect_bottom
    //});

    mainLegendDialogStyle.value = {
      position: "absolute",
      top: top, 
      left: left, 
      transform: "none" // Remove centering transformation
    };
  } else {
    console.warn('SrElevationPlot initMainLegendPosition - thisChartWrapper is null');
  }
  
};


const initOverlayLegendPosition = () => {
  const thisChartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
  if (thisChartWrapper) {
    const rect = thisChartWrapper.getBoundingClientRect();
    const rect_left = rect.left;
    const rect_top = rect.top;
    const rect_right = rect.right;
    const rect_bottom = rect.bottom;
    globalChartStore.scrollX = window.scrollX;
    globalChartStore.scrollY = window.scrollY;
    const windowScrollX = globalChartStore.scrollX;
    const windowScrollY = globalChartStore.scrollY;
    // Convert rem to pixels (1rem = 16px by default)
    const middleHorizontalOffset = rect.width / 2; // n rem from the left
    const middleX = rect.left + middleHorizontalOffset;
    const assumedTitleWidth = globalChartStore.titleOfElevationPlot.length * globalChartStore.fontSize;
    const endOfTitle = rect.left + middleHorizontalOffset + (assumedTitleWidth/2);
    const spaceSize = rect.right - endOfTitle; 
    const centerOfLegend = endOfTitle + (spaceSize/2);
    const assumedLegendWidth = assumedTitleWidth; // They are about the same cefgw 
    const leftLegendOffset = centerOfLegend - (assumedLegendWidth/2);
    const left = `${leftLegendOffset}px`; 

    const topOffset = 3 * globalChartStore.fontSize; // n rem from the top
    const top = `${rect.top + topOffset}px`; 

    // console.log('SrElevationPlot initOverlayLegendPosition:', {
    //     windowScrollX,
    //     windowScrollY,
    //     fontSize: globalChartStore.fontSize,
    //     topOffset,
    //     endOfTitle,
    //     middleHorizontalOffset,
    //     middleX,
    //     leftLegendOffset,        
    //     assumedTitleWidth,
    //     spaceSize,
    //     centerOfLegend,    
    //     top,
    //     left,
    //     rect_top,
    //     rect_left,
    //     rect_right,
    //     rect_bottom
    // });

    overlayLegendDialogStyle.value = {
      position: "absolute",
      top: top, 
      left: left, 
      transform: "none" // Remove centering transformation
    };
  } else {
    console.warn('SrElevationPlot initOverlayLegendPosition - thisChartWrapper is null');
  }
  
};


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
    if(atlChartFilterStore.selectedOverlayedReqIds.length > 0){
        const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString();
        if(reqIdStr){
            shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl08_class';
        }
    }   
    return shouldDisplay;
});

const computedDataKey = computed(() => {
    return chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr);
});

const shouldDisplayMainGradient = computed(() => {
    let shouldDisplay = false;
    if((chartReady.value) && (computedDataKey.value!='solid') && !(recTreeStore.findApiForReqId(recTreeStore.selectedReqId).includes('atl03'))){
        shouldDisplay = true;
    }
    return shouldDisplay;
});

const shouldDisplayMainSolidColorLegend = computed(() => {
    return (computedDataKey.value === 'solid');
});

const overlayReqIdStr = computed(() => {
    if(atlChartFilterStore.selectedOverlayedReqIds.length > 0){
        return atlChartFilterStore.selectedOverlayedReqIds[0].toString();
    }
    return '';
});

const computedOverlayDataKey = computed(() => {
    if(atlChartFilterStore.selectedOverlayedReqIds.length > 0){
        const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString();
        if(reqIdStr){
            return chartStore.getSelectedColorEncodeData(reqIdStr);
        }
    }
    return '';
});

const shouldDisplayOverlayGradient =computed(() => {
    return (atlChartFilterStore.selectedOverlayedReqIds.length > 0) &&
            (computedOverlayDataKey.value!='atl03_cnf') && 
            (computedOverlayDataKey.value!='atl08_class');
});


const PC_OnTooltip = computed(() => { 
    return (globalChartStore.use_y_atc_filter ? 
        'Disabled when off pointing filter in ON' : 
        'Click to show atl03 photon cloud');
});

const photonCloudBtnTooltip = computed(() => {
    if(analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading){
            return 'Photon Cloud is disabled while record is loading';
    } else {
        return  atlChartFilterStore.showPhotonCloud  ? 'Click to hide photon cloud' : PC_OnTooltip.value;
    }
});

const handleChartFinished = () => {
    //console.log('handleChartFinished ECharts update finished event -- chartWrapperRef:', chartWrapperRef.value);
    if(chartWrapperRef.value){
        if( (dialogsInitialized.value == false) && 
            (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0)){
            initMainLegendPosition();
            initOverlayLegendPosition();
            chartReady.value = true;
            dialogsInitialized.value = true; // Mark dialogs as initialized
        } else {
            console.warn('handleChartFinished - no Y data selected');
        }
    } else {
        console.warn('handleChartFinished - chartWrapperRef is null');
    }
};


async function initPlot(){
    console.log('SrElevationPlot onMounted updated webGLSupported',!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported
    try{
    // Get the computed style of the document's root element
        // Extract the font size from the computed style
        // Log the font size to the console
        //console.log(`onMounted Current root globalChartStore.fontSize: ${globalChartStore.fontSize} recTreeStore.selectedReqId:`, recTreeStore.selectedReqId);
        globalChartStore.use_y_atc_filter = false;
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');
        atlChartFilterStore.showPhotonCloud = false;
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        const reqId = props.startingReqId;
        if (reqId > 0) {
            const selectedElRecord = globalChartStore.getSelectedElevationRec();
            //console.log('SrElevationPlot onMounted selectedElRecord:', selectedElRecord);
            if(selectedElRecord){
                await processSelectedElPnt(selectedElRecord); // TBD maybe no await here to run in parallel?
            } else {
                console.warn('SrElevationPlot onMounted - selectedElRecord is null, nothing to plot yet');
            }
            initializeColorEncoding(reqId);
            // set this so if the user looks at it, it will be there
            await useAutoReqParamsStore().presetForScatterPlotOverlay(reqId);
        } else {
            console.warn('reqId is undefined');
        }        
    } catch (error) {
        console.error('Error initializing plot:', error);
    } finally {
        // Final setup after initialization
    }

}

onMounted(async () => {
    try {
        //console.log('SrElevationPlot onMounted initial chartWrapperRef:',chartWrapperRef.value);
        webGLSupported.value = !!window.WebGLRenderingContext; // Should log `true` if WebGL is supported
        globalChartStore.titleOfElevationPlot = ' Highlighted Track(s)';
        await initPlot();
        //enableTouchDragging(); // this is experimental
        requestsStore.displayHelpfulMapAdvice("Legends are draggable to any location");
    } catch (error) {
            console.error('Error during onMounted initialization:', error);
    } finally {
        loadingComponent.value = false;
    }
});

onUnmounted(() => {
    console.log('SrElevationPlot onUnmounted');
});

watch(() => recTreeStore.selectedReqId, async (newReqId) => {
    console.log('SrElevationPlot watch reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        // this is just to preset certain values that the user never changes
        await useAutoReqParamsStore().presetForScatterPlotOverlay(newReqId);
        await callPlotUpdateDebounced('from SrElevationPlot watch recTreeStore.selectedReqId');
    }
});

watch(() => plotRef.value, async (newValue,oldValue) => {
  if (!newValue){
    console.warn(`SrElevationPlot watch plotRef.value - newValue {newValue} is null or undefined, cannot proceed oldValue`,oldValue);
    return;
  } 

  // Cast to expose .chart, and safely access .value
  const chartInstance = (newValue as InstanceType<typeof VChart>).chart;

  if (chartInstance) {
    // chartInstance is type EChartsType, NOT a ref
    chartInstance.on('restore', () => {
        (async () => {
            console.log('Zoom or settings were reset!');
            dialogsInitialized.value = false; // Reset dialogsInitialized to false to re-initialize dialogs
            await initPlot(); // Re-initialize the plot to reset any settings
            if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
            await callPlotUpdateDebounced('from SrElevationPlot watch plotRef.value');
            } else {
            console.warn('No Y data selected');
            }
        })();
    });
    atlChartFilterStore.setPlotRef(newValue);
    if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
      await callPlotUpdateDebounced('from SrElevationPlot watch plotRef.value');
    } else {
      console.warn('No Y data selected');
    }
  } else {
    console.warn('Chart instance not ready yet');
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
    console.log('SrElevationPlot showPhotonCloud changed from:', oldShowPhotonCloud ,' to:', newShowPhotonCloud);
    if(!loadingComponent.value){
        if(newShowPhotonCloud){
            const runContext = await getPhotonOverlayRunContext();
            const parentReqIdStr = runContext.parentReqId.toString();
            if(runContext.reqId <= 0){ // need to fetch the data
                //console.log('showPhotonCloud runContext.reqId:', runContext.reqId, ' runContext.parentReqId:', runContext.parentReqId, 'runContext.trackFilter:', runContext.trackFilter);  
                await useAutoReqParamsStore().presetForScatterPlotOverlay(runContext.parentReqId);
                await processRunSlideRuleClicked(runContext); // worker is started here
                console.log('SrElevationPlot handlePhotonCloudChange - processRunSlideRuleClicked completed reqId:', runContext.reqId);
                if(runContext.reqId > 0){
                    const thisReqIdStr = runContext.reqId.toString();
                    initDataBindingsToChartStore([thisReqIdStr]);//after run gives us a reqId
                    chartStore.setSavedColorEncodeData(parentReqIdStr, chartStore.getSelectedColorEncodeData(parentReqIdStr));
                    chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid');
                    await initSymbolSize(runContext.reqId); // for new record
                    initializeColorEncoding(runContext.reqId);
                    // The worker will now fetch the data from the server 
                    // and write the opfs file then update 
                    // the map selected layer and the chart
                } else { 
                    console.error('SrElevationPlot handlePhotonCloudChange - processRunSlideRuleClicked failed');
                }
            } else { // we already have the data
                initializeColorEncoding(runContext.reqId);
                const sced = chartStore.getSelectedColorEncodeData(parentReqIdStr);
                //console.log('sced:', sced, ' reqIdStr:', parentReqIdStr);
                chartStore.setSavedColorEncodeData(parentReqIdStr, sced);
                chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid');
                await prepareDbForReqId(runContext.reqId);            
                //await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
                await updatePlotAndSelectedTrackMapLayer('from watch atlChartFilterStore.showPhotonCloud TRUE');
            }
            const msg = `Click 'Hide Photon Cloud Overlay' to remove highlighted track Photon Cloud data from the plot`;
            requestsStore.setConsoleMsg(msg);
        } else {
            //console.log(`calling chartStore.getSavedColorEncodeData(${recTreeStore.selectedReqIdStr})`)
            const sced = chartStore.getSavedColorEncodeData(recTreeStore.selectedReqIdStr);
            //console.log(`called chartStore.getSavedColorEncodeData(${recTreeStore.selectedReqIdStr}) sced:${sced}`)
            if(sced && (sced != 'unset')){
                //console.log('Restoring to sced:', sced, ' reqIdStr:', recTreeStore.selectedReqIdStr);
                chartStore.setSelectedColorEncodeData(recTreeStore.selectedReqIdStr, sced);
                chartStore.setSavedColorEncodeData(recTreeStore.selectedReqIdStr, 'unset');
            }
            //console.log('SrElevationPlot handlePhotonCloudChange - showPhotonCloud FALSE');
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE');
        }
    } else {
        console.warn(`SrElevationPlot Skipped handlePhotonCloudChange - Loading component is still active`);
    }
});

</script>
<template>
    <div class="sr-elevation-plot-container" v-if="loadingComponent">
        <span >Filtered Data is Loading...</span>
        <br>
        <ProgressSpinner 
            class="sr-spinner" 
            animationDuration=".75s" 
            style="width: 2rem; 
            height: 2rem;" 
            strokeWidth="8" 
            fill="var(--p-primary-300)"
        />
        
    </div>
    <div class="sr-elevation-plot-container" v-else>
        <!-- {{ webGLSupported ? 'WebGL is supported' : 'WebGL is not supported' }}
        {{ shouldDisplayMainGradient ? 'Main Gradient Displayed' : 'Main Gradient Not Displayed' }}
        {{ shouldDisplayMainSolidColorLegend ? 'Main Solid Color Legend Displayed' : 'Main Solid Color Legend Not Displayed' }}
        {{ shouldDisplayOverlayGradient ? 'Overlay Gradient Displayed' : 'Overlay Gradient Not Displayed' }}
        {{ shouldDisplayAtl08Colors ? 'Atl08 Colors Displayed' : 'Atl08 Colors Not Displayed' }}
        {{ shouldDisplayAtl03Colors ? 'Atl03 Colors Displayed' : 'Atl03 Colors Not Displayed' }} -->      
        <div class="sr-elevation-plot-content">
            <div ref="chartWrapperRef" class="chart-wrapper">
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
                    @finished="handleChartFinished"
                />
            </div> 
            <div class="sr-cycles-legend-panel">
                <Panel 
                     v-show="globalChartStore.use_y_atc_filter"
                    header="Off Pointing Cntrl" 
                    :toggleable="true" 
                    :collapsed="false"
                >
                    <SrCycleSelect/>
                    <SrSimpleYatcCntrl />
                </Panel>

                <div class="sr-legends-panel">
                    <Dialog
                        v-if="(chartWrapperRef !== undefined)"
                        v-model:visible="shouldDisplayMainGradient"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        :appendTo="chartWrapperRef"
                        :style="mainLegendDialogStyle"
                    >
                    <template #header>
                        <SrGradientLegend
                            class="chart-overlay"
                            v-if = shouldDisplayMainGradient
                            :reqIdStr="recTreeStore.selectedReqIdStr" 
                            :data_key="computedDataKey" 
                            :transparentBackground="true" 
                        />
                    </template>
                    </Dialog>
                    <Dialog
                        v-if="(chartWrapperRef !== undefined)"
                        v-model:visible="shouldDisplayMainSolidColorLegend"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        :appendTo="chartWrapperRef"
                        :style="mainLegendDialogStyle"
                    >
                        <template #header>
                            <SrSolidColorLegend
                                class="chart-overlay"
                                v-if = shouldDisplayMainSolidColorLegend
                                :reqIdStr="recTreeStore.selectedReqIdStr" 
                                :data_key="computedDataKey" 
                                :transparentBackground="true" 
                            />
                        </template>
                    </Dialog>
                    <Dialog
                        v-if="(chartWrapperRef !== undefined)"
                        v-model:visible="shouldDisplayOverlayGradient"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        :appendTo="chartWrapperRef"
                        :style="overlayLegendDialogStyle"
                    >
                        <template #header>
                            <SrGradientLegend
                                class="chart-overlay"
                                v-if = shouldDisplayOverlayGradient
                                :reqIdStr="overlayReqIdStr" 
                                :data_key="computedOverlayDataKey" 
                                :transparentBackground="true" 
                            />
                        </template>
                    </Dialog>
                    <Dialog
                        v-model:visible="shouldDisplayAtl08Colors"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        appendTo="self" 
                        :style="overlayLegendDialogStyle"
                        >
                        <template #header>
                            <SrAtl08Colors  
                                :reqIdStr="recTreeStore.selectedReqIdStr" 
                                class="chart-overlay"
                                v-if="shouldDisplayAtl08Colors"
                            />
                        </template> 
                    </Dialog>
                    <Dialog
                        v-model:visible="shouldDisplayAtl03Colors"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        appendTo="self"
                        :style="overlayLegendDialogStyle" 
                    >
                        <template #header>
                            <SrAtl03CnfColors
                                :reqIdStr="recTreeStore.selectedReqIdStr" 
                                class="chart-overlay"
                                v-if="shouldDisplayAtl03Colors" 
                            />
                        </template>
                    </Dialog>
                </div> 
            </div>
        </div> 
        <div class="sr-elevation-plot-cntrl">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="atlChartFilterStore.getShowMessage()" :class="messageClass">{{atlChartFilterStore.getMessage()}}</div>
            <SrCustomTooltip ref="tooltipRef"/>
            <div 
                class="sr-run-control" 
                v-if="!recTreeStore.selectedApi?.includes('atl03')"
                @mouseover="tooltipRef.showTooltip($event, photonCloudBtnTooltip)"
                @mouseleave="tooltipRef.hideTooltip"
            >
                <ToggleButton
                    onIcon='pi pi-eye-slash'
                    offIcon="pi pi-eye"
                    class="sr-show-hide-button"
                    v-model="atlChartFilterStore.showPhotonCloud"
                    :disabled="analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading || globalChartStore.use_y_atc_filter"
                    size="small" 
                    onLabel="Hide Photon Cloud"
                    offLabel="Show Photon Cloud"
                    rounded
                    variant="text"
                >
                </ToggleButton>
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
                    <div class="sr-multiselect-col-req">
                        <SrReqDisplay
                            v-if="(atlChartFilterStore.selectedOverlayedReqIds.length === 0)"
                            label='Show Photon Cloud Req Params'
                            :isForPhotonCloud="true"
                            :tooltipText="'The params that will be used for the Photon Cloud overlay'"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

.sr-elevation-plot-container {
  display: block;
}

.chart-wrapper {
  position: relative; /* Allows absolutely-positioned children to overlay */
  width: 100%;
  height: 60vh; /* or whatever size you want */
  margin: 0rem;
  padding: 0rem;
}

:deep(.p-dialog-mask .p-dialog.p-component.sr-floating-dialog) {
    position:absolute;
    top:50%;
    left:50%;
    /* transform: translate(-50%, -50%); */
    background-color: transparent;
    color: var(--p-text-color);
    border-radius: var(--p-border-radius);
    margin: 0rem;
    border-width: 0px;
    border-color: transparent;
}

:deep(.p-dialog-mask .p-dialog-content){
    margin: 0rem;
    padding: 0rem;
}

:deep(.p-dialog-mask .p-dialog-header){
    margin: 0rem;
    padding: 0rem;

}

.sr-elevation-plot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

.sr-elevation-plot-cntrl {
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
.sr-elevation-plot-content {
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
    justify-content:flex-start;
    align-items: center
}

.sr-cycles-legend-panel{
    display: flex;
    flex-direction: column;
    justify-content:flex-start;
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
  white-space: nowrap;  /* Make sure each items text doesnt wrap within itself */
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


:deep(.p-togglebutton-icon) {
    color: var(--p-primary-color, white); /* fallback to white */
}

:deep(.p-togglebutton) {
    color: var(--p-primary-color, white); /* fallback to white */
}

.sr-show-hide-button {
    margin: 1rem;
    min-width:10rem;
    border-radius: 2rem;
}
.sr-show-hide-button:hover {
    border-width: 1px;
    border-color: var(--primary-color);
    box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
    transition: box-shadow 0.3s ease;
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
    height: 60vh;
    width: 100%;  
    margin-bottom: 0.5rem;
    margin-left: 0rem;
    margin-right: 0rem;
    margin-top: 0rem;
    margin-bottom: 0rem;
    padding: 0rem;
    max-height: 50rem;
    max-width: 80rem;
}

/* Allow dragging on touch devices */
:deep(.p-dialog) {
  touch-action: none; /* Disable default gestures to allow dragging */
  -webkit-user-drag: none;
  user-select: none;
}


</style>
