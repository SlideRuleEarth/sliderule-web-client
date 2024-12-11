<template>
    <div class="sr-scatter-plot-container">
        <div class="sr-scatter-plot-header">
            <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
            <div v-if="useChartStore().getShowMessage()" :class="messageClass">{{useChartStore().getMessage(computedReqIdStr)}}</div>
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
                  <label :for="computedElID"> {{ `Y Data for ${findLabel(atlChartFilterStore.getReqId())}` }}</label>
                </FloatLabel>
            </div>
            <div class="sr-overlayed-reqs" v-for="overlayedReqId in atlChartFilterStore.getSelectedOverlayedReqIds()">
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
                    <label :for="`srMultiId-${overlayedReqId}`"> {{ `Y Data for ${findLabel(Number(overlayedReqId))}` }}</label>
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
            <SrAtl03ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl03_cnf')   && (chartStore.getFunc(computedReqIdStr) === 'atl03sp'))" />
            <SrAtl08ColorLegend v-if="((atl03ColorMapStore.getAtl03ColorKey() === 'atl08_class') && (chartStore.getFunc(computedReqIdStr) === 'atl03sp'))" />
          </div> 
    </div>
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import MultiSelect from "primevue/multiselect";
import { type SrMenuItem } from './SrMenuInput.vue';
import FloatLabel from "primevue/floatlabel";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, ref, computed, reactive, WritableComputedRef } from "vue";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { useAtl03ColorMapStore } from "@/stores/atl03ColorMapStore";
import { refreshScatterPlot } from "@/utils/plotUtils";
import SrAtl03ColorLegend from "./SrAtl03ColorLegend.vue";
import SrAtl08ColorLegend from "./SrAtl08ColorLegend.vue";
import { useChartStore } from "@/stores/chartStore";
import { db } from "@/db/SlideRuleDb";
import { createDuckDbClient } from '@/utils//SrDuckDb';
import { useRequestsStore } from '@/stores/requestsStore';

const chartStore = useChartStore();
const atlChartFilterStore = useAtlChartFilterStore();
const atl03ColorMapStore = useAtl03ColorMapStore();
const computedReqIdStr = computed(() => atlChartFilterStore.currentReqId.toString());
const computedElID = computed(() => `srMultiId-${computedReqIdStr.value}`);
const yDataBindingsReactive = reactive<{ [key: string]: WritableComputedRef<string[]> }>({});

function initializeBindings(reqIds: string[]) {
    //console.log('initializeBindings:', reqIds);
    reqIds.forEach((reqId) => {
        if (!(reqId in yDataBindingsReactive)) {
            yDataBindingsReactive[reqId] = computed({
                get: () => useChartStore().getYDataForChart(reqId),
                set: (value: string[]) => useChartStore().setYDataForChart(reqId, value),
            });
        }
    });
}
use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent,DataZoomComponent]);

provide(THEME_KEY, "dark");
const plotRef = ref<InstanceType<typeof VChart> | null>(null);
const reqIds = ref<SrMenuItem[]>([]);
const filteredReqIds = ref<{label:string, value:number}[]>([]);
const findLabel = (value:number) => {
    //console.log('findLabel reqIds:', reqIds.value);
    const match = reqIds.value.find(item => Number(item.value) === value);
    //console.log('findLabel:', value, 'match:', match);
    return match ? match.name : '';
};

async function onMainYDataSelectionChange(newValue: string[]) {
    console.log("Main Y Data changed:", newValue);
    // Perform any logic here:
    // - Possibly trigger a chart update
    // - Save preferences
    // For example:
    await refreshScatterPlot('from onMainYDataSelectionChange');
}

async function onOverlayYDataSelectionChange(overlayedReqId: string | number, newValue: string[]) {
    console.log(`Overlay Y Data for ${overlayedReqId} changed:`, newValue);
    // Perform overlay-specific logic here:
    // For example, re-draw only overlay plots:
    await refreshScatterPlot('from onOverlayYDataSelectionChange');
}

onMounted(async () => {

  try {
    console.log('SrScatterPlot onMounted');
    reqIds.value =  await useRequestsStore().getMenuItems();
    initializeBindings(reqIds.value.map(item => item.value));
    atlChartFilterStore.setPlotRef(plotRef.value);
    const reqId = atlChartFilterStore.getReqId();
    if (reqId > 0) {
        const func = await indexedDb.getFunc(reqId);
        atl03ColorMapStore.initializeAtl03ColorMapStore();

        if (func === 'atl03sp') {
            atl03ColorMapStore.setAtl03ColorKey('atl03_cnf');
        } else if (func.includes('atl06')) {
            atl03ColorMapStore.setAtl03ColorKey('YAPC');
        } else if (func.includes('atl08')) {
            atl03ColorMapStore.setAtl03ColorKey('atl08_class');
        }
        // Create a Set of reqIds values for quick lookup
        const successfulReqIdsSet = new Set(reqIds.value.map(item => Number(item.value)));
        const overlayedReqIds = await db.getOverlayedReqIdsOptions(reqId);
        const filteredReqIds = overlayedReqIds.filter(item => successfulReqIdsSet.has(item.value));
        const duckDbClient = await createDuckDbClient();
        const colNames = await duckDbClient.queryForColNames(await db.getFilename(reqId));
        useChartStore().setElevationDataOptionsFromFieldNames(reqId.toString(), colNames);                                                                      
        for (const oreqId of filteredReqIds) { // filter out failed reqIds
            const filename = await db.getFilename(oreqId.value);
            console.log('filename:', filename);
            // Attach the Parquet file
            await duckDbClient.insertOpfsParquet(filename);
            const colNames = await duckDbClient.queryForColNames(filename);
            useChartStore().setElevationDataOptionsFromFieldNames(oreqId.value.toString(), colNames);                                                                      
        }
        //initScatterPlotWith(reqId);
    } else {
        console.warn('reqId is undefined');
    }
  } catch (error) {
        console.error('Error during onMounted initialization:', error);
  }
});

watch(() => atlChartFilterStore.getReqId(), async (newReqId) => {
    console.log('reqId changed:', newReqId);
    if (newReqId && newReqId > 0) {
        await refreshScatterPlot('from watch atlChartFilterStore.getReqId()');
    }
});

watch(
  () => atlChartFilterStore.selectedOverlayedReqIds,
  async (newOverlayedReqIds, oldOverlayedReqIds) => {
    console.log('selectedOverlayedReqIds changed from:', oldOverlayedReqIds, 'to:', newOverlayedReqIds);
    await refreshScatterPlot('from watch atlChartFilterStore.selectedOverlayedReqIds');
  }
);



const messageClass = computed(() => {
  return {
    'message': true,
    'message-red': !useChartStore().getIsWarning(computedReqIdStr.value),
    'message-yellow': useChartStore().getIsWarning(computedReqIdStr.value)
  };
});

const computedSelectedAtl03ColorMap = computed(() => {
  return atl03ColorMapStore.getSelectedAtl03YapcColorMapName();
});

watch (() => computedSelectedAtl03ColorMap, async (newColorMap, oldColorMap) => {    
    console.log('Atl03ColorMap changed from:', oldColorMap ,' to:', newColorMap);
    atl03ColorMapStore.updateAtl03YapcColorMapValues();
    //console.log('Color Map:', atl03ColorMapStore.getAtl03YapcColorMap());
    const reqId = atlChartFilterStore.getReqId();
    if (reqId > 0) {
        await refreshScatterPlot('from watch computedSelectedAtl03ColorMap');
    }
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

.sr-scatter-plot-options {
  display: flex; 
  flex-direction: column;
  align-items: self-start;
  margin: 0.5rem;
  width: auto; /* Add this line to ensure it only takes as much width as needed */
  overflow-y: auto;
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
    width: 100%;
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
