<template>
  <v-chart class="chart" :option="option" autoresize />
</template>

<script setup lang="ts">
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { shallowRef, provide, watch,onMounted,type Ref } from "vue";
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useAtl06ChartFilterStore } from "@/stores/atl06ChartFilterStore";
import { getScatterOptions } from "@/utils/SrDuckDbUtils";
const atl06ChartFilterStore = useAtl06ChartFilterStore();
const curReqSumStore = useCurReqSumStore();


use([
  CanvasRenderer,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent
]);

provide(THEME_KEY, "dark");


let option = shallowRef();


// const loadChartData = async (reqId: number) => {
//   try {
//     const filename = await db.getFilename(reqId);
//     chartData.value = useParquetFileData(filename);
//   } catch (error) {
//     console.error('Error loading chart data:', error);
//   }
// };

onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  console.log('SrScatterPlot onMounted Loading SrScatterPlot with ID:', reqId);
  if(reqId){
    const scatterOptions = await getScatterOptions('Atl06');
    if(scatterOptions){
      option.value = scatterOptions;
    } else {
      console.warn('Failed to get scatter options');
    }
  } else {
    console.warn('reqId is undefined');
  }
});

watch(() => atl06ChartFilterStore.getUpdateScatterPlot(), async (newState, oldState) => {
  console.log(`SrScatterPlot watch atl06ChartFilterStore updateScatterPlot oldState:'${oldState} to newState:'${newState}`);
  if(newState){
    option.value = await getScatterOptions('Atl06');
    atl06ChartFilterStore.resetUpdateScatterPlot();
  }
},{ deep: true }// Ensure deep watching of nested properties
);

// Watch for changes on reqId
watch(() => atl06ChartFilterStore.getReqId(), async (newReqId, oldReqId) => {
  console.log(`SrScatterPlot reqId changed from ${oldReqId} to ${newReqId}`);
  option.value = await  getScatterOptions('Atl06');
});

</script>

<style scoped>
  .chart {
    margin: 0.5rem;
    padding: 1rem;
    max-height: 50rem;
    max-width: 50rem;
  }
</style>
