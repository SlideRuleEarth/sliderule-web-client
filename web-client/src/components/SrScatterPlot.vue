<template>
    <div>
      <ScatterChart :data="chartData" :options="chartOptions" />
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import { Chart as ChartJS, Title, Tooltip, Legend, LinearScale, PointElement } from 'chart.js';
  import { Scatter as ScatterChart } from 'vue-chartjs';
  import type { ChartData, ChartOptions } from 'chart.js';
  
  // Registering components that we will use from Chart.js
  ChartJS.register(Title, Tooltip, Legend, LinearScale, PointElement);
  
  // Setup chart data
  const chartData = ref<ChartData<'scatter'>>({
    datasets: [
      {
        label: 'Scatter Dataset1',
        data: Array.from({ length: 50 }, () => ({
          x: Math.random() * 100,
          y: Math.random() * 100,
        })),
        backgroundColor: 'rgba(255, 99, 132, 1)',
      },
    ],
  });
  
  // Setup chart options
  const chartOptions = ref<ChartOptions<'scatter'>>({
    responsive: true,
  });
  
  </script>
  