<template>
  <v-chart class="chart" :option="option" />
</template>

<script setup>
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ScatterChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { ref, provide, watch } from "vue";
import { useChartData } from '@/composables/useChartData'; 

use([
  CanvasRenderer,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent
]);

provide(THEME_KEY, "dark");

const { chartData } = useChartData();

const option = ref({
  title: {
    text: "Scatter Plot",
    left: "center"
  },
  tooltip: {
    trigger: "item",
    formatter: "({c})"
  },
  legend: {
    data: ['Scatter'],
    left: 'left'
  },
  xAxis: {},
  yAxis: {},
  series: [
    {
      name: 'Scatter',
      type: 'scatter',
      data: chartData.value,
    }
  ]
});

watch(chartData, (newData) => {
  option.value.series[0].data = newData;
});
</script>

<style scoped>
.chart {
  max-height: 50rem;
  max-width: 50rem;
}
</style>
