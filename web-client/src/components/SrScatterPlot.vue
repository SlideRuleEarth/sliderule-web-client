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
  <v-chart class="scatter-chart" :option="option" :autoresize="{throttle:500}" :loading="isLoading" :loadingOptions="{text:'Data Loading', fontSize:20, showSpinner: true, zlevel:100}" />
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch, onMounted, ref, nextTick } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import SrMultiSelectText from "./SrMultiSelectText.vue";
import { db as indexedDb } from "@/db/SlideRuleDb";
import { debounce } from "lodash";

const atlChartFilterStore = useAtlChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

const option = shallowRef();
const isLoading = ref(false);
const has_error = ref(false) as { value: boolean };

const fetchScatterOptions = async () => {
  const y_options = atlChartFilterStore.yDataForChart;
  if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
    isLoading.value = true;
    has_error.value = false;
    await nextTick(); // Wait for the DOM to update
    console.log('fetchScatterOptions started...')
    const startTime = performance.now(); // Start time
    try {
      const req_id = atlChartFilterStore.getReqId();
      const func = await indexedDb.getFunc(req_id);
      atlChartFilterStore.setFunc(func);
      const scatterOptions = await getScatterOptions();
      console.log(`returned from getScatterOptions in:${performance.now() - startTime} milliseconds.` )
      if (scatterOptions) {
        option.value = scatterOptions;
      } else {
        console.warn('Failed to get scatter options');
        has_error.value = true;
      }
    } catch (error) {
      console.error('Error fetching scatter options:', error);
      has_error.value = true;
    } finally {
      isLoading.value = false;
      atlChartFilterStore.resetUpdateScatterPlot();
      console.log(`fetchScatterOptions took ${performance.now() - startTime} milliseconds.`);
    }
  } else {
    console.warn('No y options selected');
  }
};

onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  if (reqId > 0) {
    await fetchScatterOptions();
  } else {
    console.warn('reqId is undefined');
  }
});
const debouncedFetchScatterOptions = debounce(fetchScatterOptions, 300);

watch(() => atlChartFilterStore.getUpdateScatterPlot(), async (newState) => {
  if (newState === true) {
    debouncedFetchScatterOptions();
  }
}, { deep: true });

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
