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
  </div>
  <v-chart class="scatter-chart" :option="option" :autoresize="{throttle:500}" :loading="isLoading" :loadingOptions="{text:'Data Loading', fontSize:20, showSpinner: true, zlevel:100}" />
</template>

<script setup lang="ts">
import { use } from "echarts/core"; 
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch, onMounted, ref } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import SrMultiSelectText from "./SrMultiSelectText.vue";
import { db as indexedDb } from "@/db/SlideRuleDb";

const atlChartFilterStore = useAtlChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

const option = shallowRef();
const isLoading = ref(false);

const fetchScatterOptions = async () => {
  const y_options = atlChartFilterStore.yDataForChart;
  if((y_options.length > 0) && (y_options[0] !== 'not_set')) {
    isLoading.value = true;
    const startTime = performance.now(); // Start time
    try {
      const req_id = atlChartFilterStore.getReqId();
      const func = await indexedDb.getFunc(req_id);
      const scatterOptions = await getScatterOptions(func, y_options);
      if (scatterOptions) {
        option.value = scatterOptions;
      } else {
        console.warn('Failed to get scatter options');
      }
    } catch (error) {
      console.error('Error fetching scatter options:', error);
    } finally {
      isLoading.value = false;
      atlChartFilterStore.resetUpdateScatterPlot();
      const endTime = performance.now(); // End time
      console.log(`fetchScatterOptions took ${endTime - startTime} milliseconds.`);
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

watch(() => atlChartFilterStore.getUpdateScatterPlot(), async (newState) => {
  if (newState) {
    await fetchScatterOptions();
  }
}, { deep: true });

async function changedYValues() {
  await fetchScatterOptions();
};

watch(() => curReqSumStore.getReqId(), async (newReqId) => {
  if (newReqId) {
    await fetchScatterOptions();
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

.scatter-chart {
  margin: 0.5rem;
  padding: 1rem;
  max-height: 50rem;
  max-width: 100rem;
}
</style>
