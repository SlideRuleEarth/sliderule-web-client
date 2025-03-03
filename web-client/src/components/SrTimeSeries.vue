<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed, nextTick } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useChartStore } from "@/stores/chartStore";
import { callPlotUpdateDebounced, initializeColorEncoding, initSymbolSize,selectedCyclesReactive,selectedRgtReactive } from "@/utils/plotUtils";
import { useRecTreeStore } from "@/stores/recTreeStore";
import SrPlotCntrl from "@/components/SrPlotCntrl.vue";
import SrGradientLegend from "@/components/SrGradientLegend.vue";
import { getAllFilteredCycleOptions,getAllCycleOptions } from "@/utils/SrDuckDbUtils";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import Listbox from 'primevue/listbox';
import Dialog from 'primevue/dialog';
import { AppendToType } from "@/types/SrTypes";
import SrFilterMode from "@/components/SrFilterMode.vue";
import SrCycleSelect from "@/components/SrCycleSelect.vue";
import SrYatcFilterCntrl from "@/components/SrYatcFilterCntrl.vue";

let chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
const props = defineProps({
    startingReqId: {
        type:Number, 
        default:0
    }
});

const chartStore = useChartStore();
const globalChartStore = useGlobalChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const recTreeStore = useRecTreeStore();
const loadingComponent = ref(true);

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);
const chartWrapperRef = ref<AppendToType>(undefined);
const shouldDisplayGradient = ref(false);
const gradientDialogStyle = ref<{
    backgroundColor: string;
    position: string;
    top: string;
    left: string;
    transform?: string; // Optional property
}>({
    backgroundColor: 'rgba(255, 255, 255, 0)',
    position: "absolute",
    top: "0px",
    left: "0px",
    transform: "translate(-50%, -50%)" // Initially set, removed on drag
});

const initGradientPosition = () => {
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

    console.log('SrScatterPlot initGradientPosition:', {
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

    gradientDialogStyle.value = {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        position: "absolute",
        top: top, 
        left: left, 
        transform: "none" // Remove centering transformation
    };
  } else {
    console.warn('SrScatterPlot initGradientPosition - chartWrapper is null');
  }
  
};

const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
});

const computedDataKey = computed(() => {
    return chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr);
});

onMounted(async () => {
    try {
        console.log('SrTimeSeries onMounted',props.startingReqId);

        globalChartStore.use_y_atc_filter = true;
        atlChartFilterStore.setIsWarning(true);
        atlChartFilterStore.setMessage('Loading...');
        atlChartFilterStore.showPhotonCloud = false;
        atlChartFilterStore.setSelectedOverlayedReqIds([]);
        const reqId = props.startingReqId;
        if (reqId > 0) {
            const filteredCycleOptions = await getAllFilteredCycleOptions(useRecTreeStore().selectedReqId);
            globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
            globalChartStore.setCycleOptions(filteredCycleOptions);
            await initSymbolSize(reqId);
            initializeColorEncoding(reqId);
             console.log('SrTimeSeries onMounted: rgt:', globalChartStore.getRgt(), 'spots:', globalChartStore.getSpots(), 'cycles:', globalChartStore.getCycles());
        } else {
            console.error('SrTimeSeries reqId is undefined');
        }        
        shouldDisplayGradient.value = true;
        await nextTick(); // Ensures Vue has completed the DOM rendering
        initGradientPosition();
    } catch (error) {
            console.error('Error during onMounted initialization:', error);
    } finally {
        loadingComponent.value = false;
        console.log('SrTimeSeries onMounted completed');
    }
});

watch(() => recTreeStore.selectedReqId, async (newReqId) => {
    console.log('SrTimeSeries watch reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        // this is just to preset certain values that the user never changes
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
        nextTick(initGradientPosition); // Ensure DOM updates before repositioning
    }
});

// watch(() => {
//     const reqId = recTreeStore.selectedReqId;

//     // If reqId is undefined, null, or empty, return default values
//     if (!reqId || reqId <= 0) {
//         return {
//             scOrients: globalChartStore.getScOrients(),
//             rgt: globalChartStore.getRgt(),
//             cycles: globalChartStore.getCycles(),
//             spots: globalChartStore.getSpots(),
//             gts: globalChartStore.getGts(),
//             tracks: globalChartStore.getTracks(),
//             pairs: globalChartStore.getSelectedPairOptions(),
//         };
//     }

//     // Otherwise, fetch the real values
//     return {
//         scOrients: globalChartStore.getScOrients(),
//         rgt: globalChartStore.getRgt(),
//         cycles: globalChartStore.getCycles(),
//         spots: globalChartStore.getSpots(),
//         gts: globalChartStore.getGts(),
//         tracks: globalChartStore.getTracks(),
//         pairs: globalChartStore.getSelectedPairOptions(),
//     };
// }, async (newValues, oldValues) => {
//     if((newValues.spots != oldValues.spots) || (newValues.rgt != oldValues.rgt) || (newValues.gts != oldValues.gts)){
//         const gtsValues = newValues.gts.map((gts) => gts);
//         const filteredCycleOptions = await getAllFilteredCycleOptions(recTreeStore.selectedReqId)
//         globalChartStore.setFilteredCycleOptions(filteredCycleOptions);
//         console.log('SrTimeSeries watch selected filter stuff Rgt,Spots,Gts... changed:', newValues.rgt, newValues.spots,gtsValues);
//         atlChartFilterStore.setShowPhotonCloud(false);
//     }
//     if (!loadingComponent.value) {
//         // if we have selected Y data and anything changes update the plot
//         await callPlotUpdateDebounced('SrTimeSeries watch filter parms changed');
//     } else {
//         console.warn(
//             `Skipped updateThePlot for watch filter parms - Loading component is still active`
//         );
//     }
// });

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
watch(chartWrapperRef, (newValue) => {
    console.log("chartWrapperRef updated:", newValue);
    chartWrapper = document.querySelector(".chart-wrapper") as HTMLElement;
});

</script>
<template>
    <div class="sr-time-series-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-time-series-container" v-else>
        <div class="sr-time-series-content">
            <div ref="chartWrapperRef" class="chart-wrapper">
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
            </div>
            <div class="sr-cycles-legend-panel">
                <SrCycleSelect />
                <div class="sr-legends-panel">
                    <!-- {{ shouldDisplayGradient }} {{ (chartWrapper !== null) }} -->
                    <Dialog
                        v-if="(chartWrapper !== null)"
                        v-model:visible="shouldDisplayGradient"
                        :closable="false"
                        :draggable="true"
                        :modal="false"
                        class="sr-floating-dialog"
                        :appendTo="chartWrapper"
                        :style="gradientDialogStyle"
                    >
                        <template #header>
                            <SrGradientLegend
                                class="chart-overlay"
                                v-if = "(computedDataKey!='solid')"
                                :reqIdStr="recTreeStore.selectedReqIdStr" 
                                :data_key="computedDataKey" 
                                :transparentBackground="true" 
                            />
                        </template>
                    </Dialog>
                </div>
            </div>
        </div> 
        <div class="sr-time-series-cntrl">
            <div class="sr-multiselect-container">

                <div class= "sr-multiselect-col">
                    <SrPlotCntrl
                        v-if="(recTreeStore.selectedReqId > 0)"
                        :reqId="recTreeStore.selectedReqId" 
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
    background-color: 'rgba(255, 255, 255, 0)';
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
