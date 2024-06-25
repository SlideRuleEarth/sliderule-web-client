<template>
  <v-chart class="scatter-chart" :option="option" autoresize />
</template>

<script setup lang="ts">
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent } from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch, onMounted } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtl06ChartFilterStore } from "@/stores/atl06ChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";

const atl06ChartFilterStore = useAtl06ChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

let option = shallowRef();

onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  console.log('SrScatterPlot onMounted Loading SrScatterPlot with ID:', reqId);
  if (reqId) {
    try {
      const scatterOptions = await getScatterOptions('Atl06');
      if (scatterOptions) {
        option.value = scatterOptions;
      } else {
        console.warn('Failed to get scatter options');
      }
    } catch (error) {
      console.error('Error fetching scatter options:', error);
    }
  } else {
    console.warn('reqId is undefined');
  }
});

watch(() => atl06ChartFilterStore.getUpdateScatterPlot(), async (newState, oldState) => {
  console.log(`SrScatterPlot watch atl06ChartFilterStore updateScatterPlot oldState:'${oldState} to newState:'${newState}`);
  if (newState) {
    try {
      option.value = await getScatterOptions('Atl06');
      atl06ChartFilterStore.resetUpdateScatterPlot();
    } catch (error) {
      console.error('Error updating scatter options:', error);
    }
  }
}, { deep: true });

watch(() => curReqSumStore.getReqId(), async (newReqId, oldReqId) => {
  console.log(`SrScatterPlot reqId changed from ${oldReqId} to ${newReqId}`);
  try {
    option.value = await getScatterOptions('Atl06');
  } catch (error) {
    console.error('Error fetching scatter options for new reqId:', error);
  }
});
</script>

<style scoped>
.sr-scatter-plot-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
}
.scatter-chart {
  margin: 0.5rem;
  padding: 1rem;
  max-height: 50rem;
  max-width: 50rem;
}
</style>
