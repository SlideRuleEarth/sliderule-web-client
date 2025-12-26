<template>
  <div class="sr-plot-container">
    <div class="sr-axis-selectors">
      <div class="sr-axis-select">
        <label>X Axis:</label>
        <Select
          v-model="selectedXAxis"
          :options="columns"
          placeholder="Select X axis"
          class="sr-axis-dropdown"
        />
      </div>
      <div class="sr-axis-select">
        <label>Y Axis:</label>
        <Select
          v-model="selectedYAxis"
          :options="columns"
          placeholder="Select Y axis"
          class="sr-axis-dropdown"
        />
      </div>
    </div>
    <div v-if="chartOption" class="sr-chart-wrapper">
      <VChart :option="chartOption" autoresize class="sr-chart" />
    </div>
    <div v-else class="sr-plot-placeholder">
      <p v-if="columns.length === 0">Run a query to populate axis options</p>
      <p v-else-if="rows.length === 0">No data available</p>
      <p v-else>Select X and Y axis columns</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, provide, watch } from 'vue'

// ECharts
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'

// PrimeVue Components
import Select from 'primevue/select'

// Register ECharts components
use([
  CanvasRenderer,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent
])
provide(THEME_KEY, 'dark')

const props = defineProps<{
  rows: Array<Record<string, any>>
  columns: string[]
}>()

// Plot axis selection
const selectedXAxis = ref<string | null>(null)
const selectedYAxis = ref<string | null>(null)

// Computed chart options
const chartOption = computed(() => {
  if (!selectedXAxis.value || !selectedYAxis.value || props.rows.length === 0) {
    return null
  }

  const data = props.rows.map((row) => [row[selectedXAxis.value!], row[selectedYAxis.value!]])

  // Calculate min/max for x axis
  const xValues = props.rows
    .map((row) => row[selectedXAxis.value!])
    .filter((v) => typeof v === 'number')
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const xPadding = (xMax - xMin) * 0.05 // 5% padding

  return {
    title: {
      text: `${selectedYAxis.value} vs ${selectedXAxis.value}`,
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${selectedXAxis.value}: ${params.value[0]}<br/>${selectedYAxis.value}: ${params.value[1]}`
      }
    },
    xAxis: {
      type: 'value',
      name: selectedXAxis.value,
      nameLocation: 'middle',
      nameGap: 30,
      min: xMin - xPadding,
      max: xMax + xPadding
    },
    yAxis: {
      type: 'value',
      name: selectedYAxis.value,
      nameLocation: 'middle',
      nameGap: 40
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'inside', yAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0 },
      { type: 'slider', yAxisIndex: 0 }
    ],
    series: [
      {
        type: 'scatter',
        data: data,
        symbolSize: 5
      }
    ]
  }
})

// Auto-select first two numeric columns when columns change
watch(
  () => props.columns,
  (newColumns) => {
    if (newColumns.length >= 2) {
      // Try to find numeric columns by checking first row
      if (props.rows.length > 0) {
        const numericCols = newColumns.filter((col) => typeof props.rows[0][col] === 'number')
        if (numericCols.length >= 2) {
          selectedXAxis.value = numericCols[0]
          selectedYAxis.value = numericCols[1]
        } else {
          selectedXAxis.value = newColumns[0]
          selectedYAxis.value = newColumns[1]
        }
      } else {
        selectedXAxis.value = newColumns[0]
        selectedYAxis.value = newColumns[1]
      }
    } else {
      selectedXAxis.value = null
      selectedYAxis.value = null
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.sr-plot-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: var(--p-text-muted-color);
}

.sr-plot-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.sr-axis-selectors {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.sr-axis-select {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.sr-axis-select label {
  font-size: small;
  white-space: nowrap;
}

.sr-axis-dropdown {
  min-width: 10rem;
}

.sr-chart-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

.sr-chart {
  width: 100%;
  height: 400px;
}
</style>
