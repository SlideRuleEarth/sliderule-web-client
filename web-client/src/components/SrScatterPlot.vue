<template>
    <div class="sr-scatter-plot-container" v-if="loadingComponent"><span>Loading...</span></div>
    <div class="sr-scatter-plot-container" v-else>
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
                />
                <SrRunControl 
                    :includeAdvToggle="false"
                    buttonLabel="Photon Cloud"
                />
            </div>
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
                <div v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds">
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
        <div class="sr-photon-cloud" v-if="!computedFunc.includes('atl03') && (!atlChartFilterStore.isLoading)">
            <div class="sr-scatter-checkbox-slider">
                <div class="sr-select-symbol-size">
                    <SrSliderStored
                        v-model="createComputedSymbolSizeFor(computedReqIdStr).value"
                        @update:modelValue="symbolSizeSelection"
                        :label="computedSlideLabel"
                        inputWidth="2em"
                        :min="1"
                        :max="10"
                        :defaultValue="computedSymbolSize"
                        :getValue="createGetSymbolSizeFor(computedReqIdStr)"
                        :setValue="createSetSymbolSizeFor(computedReqIdStr)"
                        :decimalPlaces=0
                        tooltipText="Symbol size for Scatter Plot"
                    />
                </div>

                <div v-for="thisReqID in atlChartFilterStore.selectedOverlayedReqIds">
                    <SrSliderStored
                        v-model="createComputedSymbolSizeFor(thisReqID.toString()).value"
                        @update:modelValue="symbolSizeSelection"
                        :label="createComputedLabelFor(thisReqID)"
                        inputWidth="2em"
                        :min="1"
                        :max="10"
                        :defaultValue="computedSymbolSize"
                        :getValue="createGetSymbolSizeFor(thisReqID.toString())"
                        :setValue="createSetSymbolSizeFor(thisReqID.toString())"
                        :decimalPlaces=0
                        tooltipText="Symbol size for Scatter Plot"
                    />
                </div>

            </div>  
            <SrReqDisplay checkboxLabel="Show request parameters for Overlayed Photon Cloud" />
            <Card>
                <template #title>
                    <div class="sr-card-title-center">Highlighted Track</div>
                </template>
                <template #content>
                    <p class="m-0">
                        {{ highlightedTrackDetails }}
                    </p>
                </template>                    
            </Card>

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
import SrReqDisplay from "./SrReqDisplay.vue";
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { callPlotUpdateDebounced,getPhotonOverlayRunContext } from "@/utils/plotUtils";
import SrRunControl from "./SrRunControl.vue";
import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
import SrSliderStored from "@/components/SrSliderStored.vue";
import { findReqMenuLabel,updateScatterOptionsOnly } from '@/utils/plotUtils';
import Card from 'primevue/card';
import { useMapStore } from "@/stores/mapStore";

const requestsStore = useRequestsStore();
const chartStore = useChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const computedReqIdStr = computed(() => atlChartFilterStore.currentReqId.toString());
const computedFunc = computed(() => chartStore.getFunc(computedReqIdStr.value));
const computedElID = computed(() => `srMultiId-${computedReqIdStr.value}`);
const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});
const loadingComponent = ref(true);
const setSymbolCounter = ref(0);

const highlightedTrackDetails = computed(() => {
    if(atlChartFilterStore.getRgts() && atlChartFilterStore.getRgts().length > 0 && atlChartFilterStore.getCycles() && atlChartFilterStore.getCycles().length > 0 && atlChartFilterStore.getTracks() && atlChartFilterStore.getTracks().length > 0 && atlChartFilterStore.getBeams() && atlChartFilterStore.getBeams().length > 0) {
        return `rgt:${atlChartFilterStore.getRgts()[0].value} cycle:${atlChartFilterStore.getCycles()[0].value} track:${atlChartFilterStore.getTracks()[0].value} beam:${atlChartFilterStore.getBeams()[0].label}`;
    } else {
        return '';
    }
});

// Create a computed property that updates and retrieves the symbol size 
const computedSymbolSize = computed<number>({
  get() {
        return chartStore.getSymbolSize(computedReqIdStr.value);
  },
  set(value: number) {
        console.log(`computedSymbolSize set value: ${value}`);
        chartStore.setSymbolSize(computedReqIdStr.value, value);
  }
});
// Function that returns a computed property for a given reqIdStr
function createComputedSymbolSizeFor(reqIdStr: string) {
  return computed<number>({
    get() {
      return chartStore.getSymbolSize(reqIdStr);
    },
    set(value: number) {
      console.log(`computedSymbolSize set value: ${value}`);
      chartStore.setSymbolSize(reqIdStr, value);
    }
  });
}

function createComputedLabelFor(reqId: number) :string {
    return `${findReqMenuLabel(reqId)} symbol size`;
}

function createGetSymbolSizeFor(reqIdStr: string) {
  return () => {
    console.log(`computedSymbolSize get value: ${chartStore.getSymbolSize(reqIdStr)}`);
    return chartStore.getSymbolSize(reqIdStr);
  };
}

/**
 * Cache all debounced setSymbolSize() functions,
 * keyed by reqIdStr.
 */
 const debouncedSetSymbolSizeCache = new Map<string, (value: number) => void>();

/**
 * Creates OR retrieves a debounced function for setting symbol size.
 * - If the function already exists in the cache for a given reqIdStr,
 *   it returns the **same** function.
 * - Otherwise, it creates a new one, stores it, and returns it.
 */
function createSetSymbolSizeFor(reqIdStr: string) {
  // Return the existing debounced function if we've created it before
  if (debouncedSetSymbolSizeCache.has(reqIdStr)) {
    return debouncedSetSymbolSizeCache.get(reqIdStr)!;
  }

  // The "real" function
  function doSetSymbolSize(value: number) {
    console.log(`computedSymbolSize set value: ${value}`);
    chartStore.setSymbolSize(reqIdStr, value);
    setSymbolCounter.value++;
  }

  // The debounced version
  const debounced = debounce(doSetSymbolSize, 300);

  // Store in our cache
  debouncedSetSymbolSizeCache.set(reqIdStr, debounced);

  // Return it so `SrSliderStored` can call it
  return debounced;
}

const computedSlideLabel = computed(() => {
    return  `${findReqMenuLabel(atlChartFilterStore.currentReqId)} symbol size`;
});

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

async function onOverlayYDataSelectionChange(thisoverlayedReqId: string | number, newValue: string[]) {
    console.log(`Overlay Y Data for ${thisoverlayedReqId} changed:`, newValue);
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
            computedSymbolSize.value = chartStore.getSymbolSize(computedReqIdStr.value);
            console.log('SrScatterPlot onMounted computedSymbolSize:', computedSymbolSize.value);
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

watch(() => setSymbolCounter.value, async (newCounter) => {
    console.log('setSymbolCounter changed:', newCounter);
    await updateScatterOptionsOnly('from watch setSymbolCounter.value');
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


const symbolSizeSelection = async () => {
    console.log('symbolSizeSelection');
    await callPlotUpdateDebounced('symbolSizeSelection');
};

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
    await updateThePlot("watch atlChartFilterStore.scOrients");
  }
);

watch(() => atlChartFilterStore.rgts,
  async (newValues, oldValues) => {
    //console.log('watch - rgts changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.rgts");
  }
);

watch(() => atlChartFilterStore.cycles,
  async (newValues, oldValues) => {
    //console.log('watch - cycles changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.cycles");
  }
);

watch(() => atlChartFilterStore.spots,
  async (newValues, oldValues) => {
    //console.log('watch - spots changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.spots");
  }
);

watch(() => atlChartFilterStore.beams,
  async (newValues, oldValues) => {
    //console.log('watch - beams changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.beams");
  }
);

watch(() => atlChartFilterStore.tracks,
  async (newValues, oldValues) => {
    //console.log('watch - tracks changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.tracks");
  }
);

watch(() => atlChartFilterStore.pairs,
  async (newValues, oldValues) => {
    //console.log('watch - pairs changed from:', oldValues, 'to:', newValues);
    await updateThePlot("watch atlChartFilterStore.pairs");
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
    background-color: var(--primary-color);
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
    width: 100%;
    margin: 0.25rem;
    border: 0.25rem;
    margin-top: 2.0rem;
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
