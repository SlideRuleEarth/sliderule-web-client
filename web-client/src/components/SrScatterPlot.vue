<template>
  <div class="sr-scatter-plot-header">
    <div class="multiselect-container">
      <SrMultiSelectText 
        v-model="atlChartFilterStore.yDataForChart"
        label="Choose" 
        @update:modelValue="changedYValues"
        menuPlaceholder="Select elevation data"
        :menuOptions="atlChartFilterStore.getElevationDataOptions()"
        :default="[atlChartFilterStore.getElevationDataOptions()[atlChartFilterStore.getNdxOfelevationDataOptionsForHeight()]]"
      />  
    </div>
    <div v-if="isLoading" class="loading-indicator">Loading...</div>
    <div v-if="has_error" class="error-message">Failed to load data. Please try again later.</div>
  </div>
  <v-chart class="scatter-chart" :option="optionsRef" :autoresize="{throttle:500}" :loading="isLoading" :loadingOptions="{text:'Data Loading', fontSize:20, showSpinner: true, zlevel:100}" />
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { provide, watch, onMounted, computed, onUnmounted } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import SrMultiSelectText from "./SrMultiSelectText.vue";
import { debounce } from "lodash";
import { fetchScatterOptions,optionsRef,cleanupSopWorker,startSopWorker } from "@/utils/workerDomUtils";

const atlChartFilterStore = useAtlChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

const isLoading = computed(() => atlChartFilterStore.getIsLoading());
const has_error = computed(() => atlChartFilterStore.getHasError());


onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  console.log('SrScatterPlot.vue onMounted reqId:', reqId);
  if (reqId > 0) {
    startSopWorker();
  } else {
    console.warn('reqId is undefined');
  }
});

onUnmounted(() => {
  console.log('SrScatterPlot.vue onUnmounted');
  cleanupSopWorker();
});

const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);

// watch(() => atlChartFilterStore.getUpdateScatterPlot(), async (newState) => {
//   if (newState === true) {
//     debouncedFetchScatterOptions();
//   }
// }, { deep: true });

async function changedYValues() {
  debouncedFetchScatterOptions();
}

watch(() => curReqSumStore.getReqId(), async (newReqId) => {
  if (newReqId && (newReqId > 0)) {
    debouncedFetchScatterOptions();
  }
});

</script>

<style scoped>
.sr-scatter-plot-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
}

.multiselect-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.loading-indicator {
  margin-left: 1rem;
  font-size: 1.2rem;
  color: #e91c5a;
}

.error-message {
  margin-left: 1rem;
  font-size: 1.2rem;
  color: #ff0000;
}

.scatter-chart {
  margin: 0.5rem;
  padding: 1rem;
  max-height: 50rem;
  max-width: 100rem;
}
</style>
