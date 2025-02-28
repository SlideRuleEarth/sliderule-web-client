<script setup lang="ts">
import { use } from "echarts/core"; 
import ToggleButton from "primevue/togglebutton";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, onUnmounted, nextTick, ref, computed } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
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
import SrGradientLegend from "./SrGradientLegend.vue";
import SrSolidColorLegend from "./SrSolidColorLegend.vue";
import SrReqDisplay from "./SrReqDisplay.vue";
import { getAllFilteredCycleOptions,prepareDbForReqId } from "@/utils/SrDuckDbUtils";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import SrAtl03CnfColors from "@/components/SrAtl03CnfColors.vue";
import SrAtl08Colors from "@/components/SrAtl08Colors.vue";
import SrCustomTooltip from "@/components/SrCustomTooltip.vue";
import Dialog from 'primevue/dialog';
import { AppendToType } from "@/types/SrTypes";
import { useAnalysisTabStore } from "@/stores/analysisTabStore";
import { clicked,filterByAtc } from "@/utils/SrMapUtils";
import Tooltip from 'primevue/tooltip';

const tooltipRef = ref();

let chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
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
const analysisTabStore = useAnalysisTabStore();
const loadingComponent = ref(true);

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);
const chartWrapperRef = ref<AppendToType>(undefined);
const webGLSupported = ref<boolean>(!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported
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
  const chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
  if (chartWrapper) {
    const rect = chartWrapper.getBoundingClientRect();
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

    console.log('SrElevationPlot initMainLegendPosition:', {
        windowScrollX,
        windowScrollY,
        fontSize: globalChartStore.fontSize,
        topOffset,
        endOfTitle,
        middleHorizontalOffset,
        middleX,
        leftLegendOffset,        
        assumedTitleWidth,
        spaceSize,
        centerOfLegend,    
        top,
        left,
        rect_top,
        rect_left,
        rect_right,
        rect_bottom
    });

    mainLegendDialogStyle.value = {
      position: "absolute",
      top: top, 
      left: left, 
      transform: "none" // Remove centering transformation
    };
  } else {
    console.warn('SrElevationPlot initMainLegendPosition - chartWrapper is null');
  }
  
};


const initOverlayLegendPosition = () => {
  const chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
  if (chartWrapper) {
    const rect = chartWrapper.getBoundingClientRect();
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

    console.log('SrElevationPlot initOverlayLegendPosition:', {
        windowScrollX,
        windowScrollY,
        fontSize: globalChartStore.fontSize,
        topOffset,
        endOfTitle,
        middleHorizontalOffset,
        middleX,
        leftLegendOffset,        
        assumedTitleWidth,
        spaceSize,
        centerOfLegend,    
        top,
        left,
        rect_top,
        rect_left,
        rect_right,
        rect_bottom
    });

    overlayLegendDialogStyle.value = {
      position: "absolute",
      top: top, 
      left: left, 
      transform: "none" // Remove centering transformation
    };
  } else {
    console.warn('SrElevationPlot initOverlayLegendPosition - chartWrapper is null');
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
    if((computedDataKey.value!='solid') && !(recTreeStore.findApiForReqId(recTreeStore.selectedReqId).includes('atl03'))){
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

const filterGood = computed(() => {
    return ((globalChartStore.getCycles().length === 1) && (globalChartStore.getRgt()>=0) && (globalChartStore.getSpots().length === 1));
});

const enableThePhotonCloud = computed(() => {
    return (!useMapStore().getIsLoading() && filterGood.value);
}); 

const photonCloudBtnTooltip = computed(() => {
    if(!filterGood.value){
        return 'Photon Cloud is disabled due to:\n multiple Cycles, Rgts, Spots, or Gts.\nClick on a track to enable this.';
    } else {
        if(useMapStore().getIsLoading()){
            return 'Photon Cloud is disabled while record is loading';
        } else {
            //return  atlChartFilterStore.showPhotonCloud  ? 'Click to hide photon cloud':'Click to show atl03 photon cloud';
            return '';
        }
    }

});

const enableTouchDragging = () =>{
    const dialogs = document.querySelectorAll('.sr-floating-dialog');

    dialogs.forEach((dialogElement) => {
        const dialog = dialogElement as HTMLElement; // Cast to HTMLElement for style access
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        const onTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            const rect = dialog.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
        };

        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            dialog.style.left = `${initialLeft + dx}px`;
            dialog.style.top = `${initialTop + dy}px`;
        };

        const onTouchEnd = () => {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        dialog.addEventListener('touchstart', onTouchStart);
  });
}

onMounted(async () => {
    try {
        console.log('SrElevationPlot onMounted initial chartWrapper:',chartWrapper);
        webGLSupported.value = !!window.WebGLRenderingContext; // Should log `true` if WebGL is supported
        //console.log('SrElevationPlot onMounted updated webGLSupported',!!window.WebGLRenderingContext); // Should log `true` if WebGL is supported
        // Get the computed style of the document's root element
        // Extract the font size from the computed style
        // Log the font size to the console
        console.log(`onMounted Current root globalChartStore.fontSize: ${globalChartStore.fontSize} recTreeStore.selectedReqId:`, recTreeStore.selectedReqId);

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
        //setTimeout(updateDialogPosition, 100); // Ensure DOM is fully loaded
        await nextTick(); // Ensures Vue has completed the DOM rendering
        initMainLegendPosition();
        initOverlayLegendPosition();
        //console.log('SrElevationPlot onMounted completed');

        enableTouchDragging();
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

watch(() => plotRef.value, async (newPlotRef) => {
    //console.log('plotRef changed:', newPlotRef);
    if (newPlotRef) {
        console.warn('SrElevationPlot watch plotRef changed:', newPlotRef);
        atlChartFilterStore.setPlotRef(plotRef.value);
        if(chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0){
            await callPlotUpdateDebounced('from SrElevationPlot watch plotRef.value');
        } else {
            console.warn('SrElevationPlot watch plotRef.value - no Y data selected');
        }
        nextTick(initMainLegendPosition); // Ensure DOM updates before repositioning
        nextTick(initOverlayLegendPosition); // Ensure DOM updates before repositioning
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
                    await initSymbolSize(runContext.reqId);
                    chartStore.setSavedColorEncodeData(parentReqIdStr, chartStore.getSelectedColorEncodeData(parentReqIdStr));
                    chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid');
                    initializeColorEncoding(runContext.reqId);
                } else { 
                    console.error('SrElevationPlot handlePhotonCloudChange - processRunSlideRuleClicked failed');
                }
            } else { // we already have the data
                await initSymbolSize(runContext.reqId);
                initializeColorEncoding(runContext.reqId);
                const sced = chartStore.getSelectedColorEncodeData(parentReqIdStr);
                //console.log('sced:', sced, ' reqIdStr:', parentReqIdStr);
                chartStore.setSavedColorEncodeData(parentReqIdStr, sced);
                chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid');
                await prepareDbForReqId(runContext.reqId);            
                await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE');
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

watch(() => {
    const reqId = recTreeStore.selectedReqId;

    // If reqId is undefined, null, or empty, return default values
    if (!reqId || reqId <= 0) {
        return {
            scOrients: globalChartStore.getScOrients(),
            rgt: globalChartStore.getRgt(),
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
        rgt: globalChartStore.getRgt(),
        cycles: globalChartStore.getCycles(),
        spots: globalChartStore.getSpots(),
        gts: globalChartStore.getGts(),
        tracks: globalChartStore.getTracks(),
        pairs: globalChartStore.getSelectedPairOptions(),
    };
}, async (newValues, oldValues) => {
    if((newValues.spots != oldValues.spots) || (newValues.rgt != oldValues.rgt) || (newValues.gts != oldValues.gts)){
        const gtsValues = newValues.gts.map((gts) => gts);
        const filteredCycleOptions = await getAllFilteredCycleOptions(recTreeStore.selectedReqId)
        globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
        console.log('SrElevationPlot watch selected filter stuff Rgt,Spots,Gts... changed:', newValues.rgt, newValues.spots,gtsValues);
        atlChartFilterStore.setShowPhotonCloud(false);
    }
    if (!loadingComponent.value) {
        // if we have selected Y data and anything changes update the plot
        await callPlotUpdateDebounced('SrElevationPlot watch filter parms changed');
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

watch(chartWrapperRef, (newValue) => {
    console.log("chartWrapperRef updated:", newValue);
    chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
});

</script>
<template>
    <div class="sr-elevation-plot-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-elevation-plot-container" v-else>
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
                />
                <Dialog
                    v-if="(chartWrapper !== null)"
                    v-model:visible="shouldDisplayMainGradient"
                    :closable="false"
                    :draggable="true"
                    :modal="false"
                    class="sr-floating-dialog"
                    :appendTo="chartWrapper"
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
                    v-if="(chartWrapper !== null)"
                    v-model:visible="shouldDisplayMainSolidColorLegend"
                    :closable="false"
                    :draggable="true"
                    :modal="false"
                    class="sr-floating-dialog"
                    :appendTo="chartWrapper"
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
                    v-if="(chartWrapper !== null)"
                    v-model:visible="shouldDisplayOverlayGradient"
                    :closable="false"
                    :draggable="true"
                    :modal="false"
                    class="sr-floating-dialog"
                    :appendTo="chartWrapper"
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
                    class="sr-show-hide-button"
                    onLabel="Hide Atl03 Photons"
                    offLabel="Show Atl03 Photons"
                    v-model="atlChartFilterStore.showPhotonCloud"
                    :disabled="!enableThePhotonCloud"
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
