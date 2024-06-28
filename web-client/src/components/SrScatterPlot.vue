<template>
  <div class="sr-scatter-plot-header">
    <div class="multiselect-container">
      <SrMultiSelectText 
        v-model="atl06ChartFilterStore.yDataForChart"
        label="Choose" 
        @update:modelValue="changedYValues"
        menuPlaceholder="Select elevation data"
        :menuOptions=atl06ChartFilterStore.getElevationDataOptions()
        :default="[atl06ChartFilterStore.getElevationDataOptions()[atl06ChartFilterStore.getNdxOfelevationDataOptionsForHeight()]]"
      /> 
    </div> 
  </div>
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
import SrMultiSelectText from "./SrMultiSelectText.vue";

const atl06ChartFilterStore = useAtl06ChartFilterStore();
const curReqSumStore = useCurReqSumStore();

use([CanvasRenderer, ScatterChart, TitleComponent, TooltipComponent, LegendComponent]);

provide(THEME_KEY, "dark");

let option = shallowRef();

onMounted(async () => {
  const reqId = curReqSumStore.getReqId();
  console.log('SrScatterPlot onMounted Loading SrScatterPlot with ID:', reqId);
  if (reqId > 0) {
    try {
      //const y = ['h_mean'];

      const scatterOptions = await getScatterOptions('Atl06',atl06ChartFilterStore.getYDataForChartValues());
      if (scatterOptions) {
        console.log('SrScatterPlot onMounted scatterOptions:', scatterOptions);
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
      option.value = await getScatterOptions('Atl06',atl06ChartFilterStore.getYDataForChartValues());
      atl06ChartFilterStore.resetUpdateScatterPlot();
    } catch (error) {
      console.error('Error updating scatter options:', error);
    }
  }
}, { deep: true });

async function changedYValues(){
  try {
    console.log('changedYValues Fetching scatter options for new atl06ChartFilterStore.getYDataForChartValues():', atl06ChartFilterStore.getYDataForChartValues());
    option.value = await getScatterOptions('Atl06',atl06ChartFilterStore.getYDataForChartValues());
  } catch (error) {
    console.error('Error updating scatter options:', error);
  }
};

watch(() => curReqSumStore.getReqId(), async (newReqId, oldReqId) => {
  console.log(`SrScatterPlot reqId changed from ${oldReqId} to ${newReqId}`);
  try {
    console.log('Fetching scatter options for new atl06ChartFilterStore.getYDataForChartValues():', atl06ChartFilterStore.getYDataForChartValues());
    option.value = await getScatterOptions('Atl06',atl06ChartFilterStore.getYDataForChartValues());
  } catch (error) {
    console.error(`Error fetching scatter options for new reqId:${newReqId}`, error);
  }
});
</script>

<style scoped>
.sr-scatter-plot-header {
  display: flex;
  justify-content:center;
  align-items:center;
  margin: 0.5rem;
  padding: 1rem;
}

.multiselect-container {
  display: inline-block;
}

.scatter-chart {
  margin: 0.5rem;
  padding: 1rem;
  max-height: 50rem;
  max-width: 50rem;
}
</style>
