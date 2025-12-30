<template>
  <div class="sr-plot-container">
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="plot">Plot</Tab>
        <Tab value="control">Plot Control</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="plot">
          <div v-if="chartOption" class="sr-chart-wrapper">
            <VChart :key="chartKey" :option="chartOption" autoresize class="sr-chart" />
          </div>
          <div v-else class="sr-plot-placeholder">
            <p v-if="columns.length === 0">Run a query to see a plot</p>
            <p v-else-if="rows.length === 0">No data available</p>
            <p v-else>Select X and Y axis columns</p>
          </div>
        </TabPanel>

        <TabPanel value="control">
          <div v-if="columns.length === 0" class="sr-plot-placeholder">
            <p>Run a query to populate axis options</p>
          </div>
          <div v-else class="sr-control-panel">
            <!-- Row 1: Title -->
            <div class="sr-control-row">
              <div class="sr-control-item">
                <label>Title:</label>
                <InputText v-model="plotTitle" :placeholder="defaultTitle" class="sr-title-input" />
              </div>
            </div>
            <!-- Row 2: X and Y Axis -->
            <div class="sr-control-row">
              <div class="sr-control-item">
                <label>X:</label>
                <Select
                  v-model="selectedXAxis"
                  :options="columns"
                  placeholder="X axis"
                  class="sr-axis-dropdown"
                />
              </div>
              <div class="sr-control-item">
                <label>Y:</label>
                <Select
                  v-model="selectedYAxis"
                  :options="columns"
                  placeholder="Y axis"
                  class="sr-axis-dropdown"
                />
              </div>
            </div>
            <!-- Row 3: Point Size and Color -->
            <div class="sr-control-row">
              <div class="sr-control-item">
                <label>Size:</label>
                <InputNumber v-model="pointSize" :min="1" :max="20" class="sr-size-input" />
              </div>
              <div class="sr-control-item">
                <label>Color:</label>
                <ColorPicker v-model="pointColor" class="sr-color-picker" />
              </div>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
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
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ColorPicker from 'primevue/colorpicker'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'

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

// Tab and plot controls
const activeTab = ref('plot')
const plotTitle = ref<string>('')
const selectedXAxis = ref<string | null>(null)
const selectedYAxis = ref<string | null>(null)
const pointSize = ref<number>(5)
const pointColor = ref<string>('4287f5')

// Default title based on selected axes
const defaultTitle = computed(() => {
  if (selectedXAxis.value && selectedYAxis.value) {
    return `${selectedYAxis.value} vs ${selectedXAxis.value}`
  }
  return 'Plot title'
})

// Key to force chart re-render when axes change (resets zoom)
const chartKey = computed(() => `${selectedXAxis.value}-${selectedYAxis.value}`)

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
      text: plotTitle.value || `${selectedYAxis.value} vs ${selectedXAxis.value}`,
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
        symbolSize: pointSize.value,
        itemStyle: {
          color: `#${pointColor.value}`
        }
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

.sr-control-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
}

.sr-control-row {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.sr-control-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
}

.sr-control-item label {
  font-size: small;
  white-space: nowrap;
}

.sr-title-input {
  width: 12rem;
}

.sr-axis-dropdown {
  width: 8rem;
}

.sr-size-input {
  width: 5rem;
}

.sr-color-picker {
  width: 2.5rem;
}

:deep(.sr-axis-dropdown .p-select-label) {
  font-size: small;
}

:deep(.sr-size-input .p-inputnumber-input) {
  font-size: small;
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
