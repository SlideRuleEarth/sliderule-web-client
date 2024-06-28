<template>
  <div class="sr-scatter-plot-header">
    <div class="multiselect-container">
      <SrMultiSelectText 
        v-model="atl06ChartFilterStore.yDataForChart"
        label="Choose" 
        @update:modelValue="changedYValues"
        menuPlaceholder="Select elevation data"
        :menuOptions="atl06ChartFilterStore.getElevationDataOptions()"
        :default="[atl06ChartFilterStore.getElevationDataOptions()[atl06ChartFilterStore.getNdxOfelevationDataOptionsForHeight()]]"
      />  
    </div>
    <div v-if="isLoading" class="loading-indicator">Loading...</div>
  </div>
  <v-chart class="scatter-chart" :option="option" autoresize v-if="!isLoading"/>
</template>

<script setup lang="ts">
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch, onMounted, ref } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtl06ChartFilterStore } from "@/stores/atl06ChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
import SrMultiSelectText from "./SrMultiSelectText.vue";

const atl06ChartFilterStore = useAtl06ChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

const option = shallowRef();
const isLoading = ref(false);

const fetchScatterOptions = async () => {
  isLoading.value = true;
  try {
    const scatterOptions = await getScatterOptions('Atl06', atl06ChartFilterStore.getYDataForChartValues());
    if (scatterOptions) {
      option.value = scatterOptions;
    } else {
      console.warn('Failed to get scatter options');
    }
  } catch (error) {
    console.error('Error fetching scatter options:', error);
  } finally {
    isLoading.value = false;
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

watch(() => atl06ChartFilterStore.getUpdateScatterPlot(), async (newState) => {
  if (newState) {
    await fetchScatterOptions();
    atl06ChartFilterStore.resetUpdateScatterPlot();
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
  display: inline-block;
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
  max-width: 50rem;
}
</style>
