<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent
} from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'
import { provide, watch, onMounted, ref, computed, nextTick } from 'vue'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import { useChartStore } from '@/stores/chartStore'
import { callPlotUpdateDebounced, checkAndSetFilterForTimeSeries } from '@/utils/plotUtils'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useActiveTabStore } from '@/stores/activeTabStore'
import SrPlotCntrl from '@/components/SrPlotCntrl.vue'
import SrGradientLegend from '@/components/SrGradientLegend.vue'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import Dialog from 'primevue/dialog'
import type { AppendToType } from '@/types/SrTypes'
import SrCycleSelect from '@/components/SrCycleSelect.vue'
import SrSimpleYatcCntrl from './SrSimpleYatcCntrl.vue'
import { createLogger } from '@/utils/logger'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

const logger = createLogger('SrTimeSeries')

const props = defineProps<{
  startingReqId?: number
}>()

const chartStore = useChartStore()
const globalChartStore = useGlobalChartStore()
const atlChartFilterStore = useAtlChartFilterStore()
const activeTabStore = useActiveTabStore()
const recTreeStore = useRecTreeStore()
const fieldNameStore = useFieldNameStore()
const loadingComponent = ref(true)

// Custom tooltip ref
const tooltipRef = ref()

// Zoom select mode state (custom drag-to-zoom rectangle)
const zoomSelectMode = ref(false)
const isDrawingZoomRect = ref(false)
const zoomRectStart = ref({ x: 0, y: 0 })
const zoomRectEnd = ref({ x: 0, y: 0 })

// Computed style for the zoom selection rectangle
const zoomRectStyle = computed(() => {
  const left = Math.min(zoomRectStart.value.x, zoomRectEnd.value.x)
  const top = Math.min(zoomRectStart.value.y, zoomRectEnd.value.y)
  const width = Math.abs(zoomRectEnd.value.x - zoomRectStart.value.x)
  const height = Math.abs(zoomRectEnd.value.y - zoomRectStart.value.y)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

// Zoom selection mouse event handlers
function handleZoomMouseDown(e: MouseEvent) {
  if (!zoomSelectMode.value) return
  const wrapper = chartWrapperRef.value as HTMLElement
  if (!wrapper) {
    logger.warn('handleZoomMouseDown: chartWrapperRef is null')
    return
  }

  e.preventDefault()
  e.stopPropagation()

  const rect = wrapper.getBoundingClientRect()
  isDrawingZoomRect.value = true
  zoomRectStart.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  zoomRectEnd.value = { ...zoomRectStart.value }
  logger.debug('Zoom rectangle started', { start: zoomRectStart.value })
}

function handleZoomMouseMove(e: MouseEvent) {
  if (!isDrawingZoomRect.value) return
  const wrapper = chartWrapperRef.value as HTMLElement
  if (!wrapper) return

  const rect = wrapper.getBoundingClientRect()
  zoomRectEnd.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

async function handleZoomMouseUp() {
  if (!isDrawingZoomRect.value) return
  isDrawingZoomRect.value = false

  const chart = plotRef.value?.chart
  if (!chart) return

  // Convert pixel coordinates to data values using ECharts API
  const startData = chart.convertFromPixel('grid', [zoomRectStart.value.x, zoomRectStart.value.y])
  const endData = chart.convertFromPixel('grid', [zoomRectEnd.value.x, zoomRectEnd.value.y])

  if (!startData || !endData) {
    logger.warn('Failed to convert pixel coordinates to data values')
    return
  }

  // Ensure we have a meaningful selection (not just a click)
  const minSelectionSize = 5 // pixels
  if (
    Math.abs(zoomRectEnd.value.x - zoomRectStart.value.x) < minSelectionSize &&
    Math.abs(zoomRectEnd.value.y - zoomRectStart.value.y) < minSelectionSize
  ) {
    logger.debug('Selection too small, ignoring')
    return
  }

  // Set zoom extents (ensure min < max)
  atlChartFilterStore.xZoomStartValue = Math.min(startData[0], endData[0])
  atlChartFilterStore.xZoomEndValue = Math.max(startData[0], endData[0])
  atlChartFilterStore.yZoomStartValue = Math.min(startData[1], endData[1])
  atlChartFilterStore.yZoomEndValue = Math.max(startData[1], endData[1])

  logger.debug('Zoom rectangle selection applied', {
    xStart: atlChartFilterStore.xZoomStartValue,
    xEnd: atlChartFilterStore.xZoomEndValue,
    yStart: atlChartFilterStore.yZoomStartValue,
    yEnd: atlChartFilterStore.yZoomEndValue
  })

  // Trigger chart update
  await callPlotUpdateDebounced('from zoom rectangle selection')

  // Disable zoom select mode after use
  zoomSelectMode.value = false
}

function handleZoomMouseLeave() {
  if (isDrawingZoomRect.value) {
    isDrawingZoomRect.value = false
  }
}

// Custom toolbar handlers
function saveChartAsImage() {
  if (!plotRef.value?.chart) {
    logger.warn('Cannot save chart: chart instance not available')
    return
  }
  try {
    const dataUrl = plotRef.value.chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#1e1e1e'
    })
    const link = document.createElement('a')
    link.download = `time-series-plot-${Date.now()}.png`
    link.href = dataUrl
    link.click()
    logger.debug('Chart saved as image')
  } catch (error) {
    logger.error('Error saving chart as image', { error })
  }
}

function resetChartZoom() {
  if (!plotRef.value?.chart) {
    logger.warn('Cannot reset zoom: chart instance not available')
    return
  }
  try {
    logger.debug('Resetting chart zoom')
    // Clear both percentage and value-based zoom fields in store
    atlChartFilterStore.resetZoom()

    const chart = plotRef.value.chart
    // Reset X-axis dataZoom (slider at index 0, inside at index 2 shares state)
    chart.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      start: 0,
      end: 100
    })
    // Reset Y-axis dataZoom (slider at index 1, inside at index 3 shares state)
    chart.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 1,
      start: 0,
      end: 100
    })
  } catch (error) {
    logger.error('Error resetting chart zoom', { error })
  }
}

use([
  CanvasRenderer,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent
])

provide(THEME_KEY, 'dark')
const plotRef = ref<InstanceType<typeof VChart> | null>(null)
const chartWrapperRef = ref<AppendToType>(undefined)
const chartReady = ref(false)
const shouldDisplayGradient = ref(false)
const gradientDialogStyle = ref<{
  backgroundColor: string
  position: string
  top: string
  left: string
  transform?: string // Optional property
}>({
  backgroundColor: 'rgba(255, 255, 255, 0)',
  position: 'absolute',
  top: '0px',
  left: '0px',
  transform: 'translate(-50%, -50%)' // Initially set, removed on drag
})
const mission = computed(() => {
  return fieldNameStore.getMissionForReqId(recTreeStore.selectedReqId)
})

const cyclesLabel = computed(() => {
  if (mission.value === 'ICESat-2') {
    return 'Cycles'
  } else if (mission.value === 'GEDI') {
    return 'Orbits'
  } else {
    return 'Cycles'
  }
})

const computedApi = computed(() => recTreeStore.selectedApi)

const notAtl13xTimeSeries = computed(() =>
  computedApi.value === 'atl13x' ? (activeTabStore.isActiveTabTimeSeries ? false : true) : true
)

const initGradientPosition = () => {
  const thisChartWrapper = document.querySelector('.chart-wrapper') as HTMLElement
  if (thisChartWrapper) {
    const rect = thisChartWrapper.getBoundingClientRect()
    // const _rect_left = rect.left
    // const _rect_top = rect.top
    // const _rect_right = rect.right
    // const _rect_bottom = rect.bottom
    globalChartStore.scrollX = window.scrollX
    globalChartStore.scrollY = window.scrollY
    // const _windowScrollX = globalChartStore.scrollX
    // const _windowScrollY = globalChartStore.scrollY
    // Convert rem to pixels (1rem = 16px by default)
    const middleHorizontalOffset = rect.width / 2 // n rem from the left
    // const _middleX = rect.left + middleHorizontalOffset
    const assumedTitleWidth =
      globalChartStore.titleOfElevationPlot.length * globalChartStore.fontSize
    const endOfTitle = rect.left + middleHorizontalOffset + assumedTitleWidth / 2
    const spaceSize = rect.right - endOfTitle
    const centerOfLegend = endOfTitle + spaceSize / 2
    const assumedLegendWidth = assumedTitleWidth // They are about the same cefgw
    const leftLegendOffset = centerOfLegend - assumedLegendWidth / 2
    const left = `${leftLegendOffset}px`

    const topOffset = 0.25 * globalChartStore.fontSize // n rem from the top
    const top = `${rect.top + topOffset}px`

    // console.log('SrTimeSeries initGradientPosition:', {
    //     windowScrollX,
    //     windowScrollY,
    //     fontSize: globalChartStore.fontSize,
    //     topOffset,
    //     endOfTitle,
    //     middleHorizontalOffset,
    //     middleX,
    //     leftLegendOffset,
    //     assumedTitleWidth,
    //     spaceSize,
    //     centerOfLegend,
    //     top,
    //     left,
    //     rect_top,
    //     rect_left,
    //     rect_right,
    //     rect_bottom
    // });

    gradientDialogStyle.value = {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      position: 'absolute',
      top: top,
      left: left,
      transform: 'none' // Remove centering transformation
    }
  } else {
    logger.warn('initGradientPosition - chartWrapper is null')
  }
}
const reqId = computed(() => recTreeStore.selectedReqId)

const computedDataKey = computed(() => {
  return chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr)
})

const handleChartFinished = () => {
  //console.log('handleChartFinished ECharts update finished event -- chartWrapperRef:', chartWrapperRef.value);
  if (chartWrapperRef.value) {
    if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
      initGradientPosition()
      chartReady.value = true
    } else {
      logger.warn('handleChartFinished - no Y data selected')
    }
  } else {
    logger.warn('handleChartFinished - chartWrapperRef is null')
  }
}

onMounted(() => {
  void (async () => {
    try {
      logger.debug('onMounted', { startingReqId: props.startingReqId })
      if (mission.value === 'ICESat-2') {
        globalChartStore.use_y_atc_filter = true
      } else {
        globalChartStore.use_y_atc_filter = false
      }
      globalChartStore.use_y_atc_filter = true
      chartStore.setUseSelectedMinMax(recTreeStore.selectedReqIdStr, true)
      atlChartFilterStore.setIsWarning(true)
      atlChartFilterStore.setMessage('Loading...')
      atlChartFilterStore.showPhotonCloud = false
      atlChartFilterStore.setSelectedOverlayedReqIds([])
      const reqId = props.startingReqId ?? 0
      if (reqId > 0) {
        //console.log('SrTimeSeries onMounted: rgt:', globalChartStore.getRgt(), 'spots:', globalChartStore.getSpots(), 'cycles:', globalChartStore.getCycles());
      } else {
        logger.error('reqId is undefined')
      }
      shouldDisplayGradient.value = true
      await nextTick() // Ensures Vue has completed the DOM rendering
      initGradientPosition()
      await checkAndSetFilterForTimeSeries()
    } catch (error) {
      logger.error('Error during onMounted initialization', {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      loadingComponent.value = false
      //console.log('SrTimeSeries onMounted completed');
    }
  })()
})

watch(
  () => plotRef.value,
  (newPlotRef) => {
    //console.log('plotRef changed:', newPlotRef);
    if (newPlotRef) {
      logger.debug('watch plotRef changed', { newPlotRef })
      atlChartFilterStore.setPlotRef(plotRef.value)
      if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
        void callPlotUpdateDebounced('from SrTimeSeries watch plotRef.value')
      } else {
        logger.warn('watch plotRef.value - no Y data selected')
      }
      void nextTick(initGradientPosition) // Ensure DOM updates before repositioning
    }
  }
)

watch(
  () => globalChartStore.showPlotTooltip,
  (newValue) => {
    if (plotRef.value?.chart) {
      plotRef.value.chart.setOption({ tooltip: { show: newValue } })
    }
  }
)
</script>
<template>
  <div class="sr-time-series-container" v-if="loadingComponent"><span>Loading...</span></div>
  <div class="sr-time-series-container" v-else>
    <div class="sr-time-series-content">
      <div ref="chartWrapperRef" class="chart-wrapper" :class="{ 'sr-zoom-mode': zoomSelectMode }">
        <v-chart
          ref="plotRef"
          class="time-series-chart"
          :manual-update="true"
          :autoresize="{ throttle: 500 }"
          :loading="atlChartFilterStore.isLoading"
          :loadingOptions="{
            text: 'Data Loading',
            fontSize: 20,
            showSpinner: true,
            zlevel: 100
          }"
          @finished="handleChartFinished"
        />
        <!-- Custom toolbar (replaces ECharts toolbox which causes rendering issues with large datasets) -->
        <div class="sr-chart-toolbar">
          <div
            @mouseover="tooltipRef.showTooltip($event, 'Save as Image')"
            @mouseleave="tooltipRef.hideTooltip()"
          >
            <Button
              icon="pi pi-download"
              severity="secondary"
              text
              rounded
              class="sr-glow-button"
              aria-label="Save as Image"
              @click="saveChartAsImage"
            />
          </div>
          <div
            @mouseover="tooltipRef.showTooltip($event, 'Reset Zoom')"
            @mouseleave="tooltipRef.hideTooltip()"
          >
            <Button
              icon="pi pi-refresh"
              severity="secondary"
              text
              rounded
              class="sr-glow-button"
              aria-label="Reset Zoom"
              @click="resetChartZoom"
            />
          </div>
          <div
            @mouseover="
              tooltipRef.showTooltip(
                $event,
                zoomSelectMode ? 'Cancel Zoom Selection' : 'Drag to Zoom'
              )
            "
            @mouseleave="tooltipRef.hideTooltip()"
          >
            <Button
              icon="pi pi-search-plus"
              :severity="zoomSelectMode ? 'primary' : 'secondary'"
              :text="!zoomSelectMode"
              rounded
              aria-label="Drag to Zoom"
              :class="['sr-glow-button', { 'sr-zoom-select-active': zoomSelectMode }]"
              @click="zoomSelectMode = !zoomSelectMode"
            />
          </div>
        </div>
        <!-- Zoom mode overlay - captures mouse events when zoom select is active -->
        <div
          v-if="zoomSelectMode"
          class="sr-zoom-overlay"
          @mousedown="handleZoomMouseDown"
          @mousemove="handleZoomMouseMove"
          @mouseup="handleZoomMouseUp"
          @mouseleave="handleZoomMouseLeave"
        />
        <!-- Zoom selection rectangle overlay -->
        <div v-if="isDrawingZoomRect" class="sr-zoom-select-rect" :style="zoomRectStyle" />
      </div>
      <div class="sr-cycles-legend-panel">
        <SrCycleSelect :label="cyclesLabel" />
        <SrSimpleYatcCntrl v-if="mission === 'ICESat-2' && notAtl13xTimeSeries" />
        <div class="sr-legends-panel">
          <Dialog
            v-if="chartWrapperRef !== undefined"
            v-model:visible="shouldDisplayGradient"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            :appendTo="chartWrapperRef"
            :style="gradientDialogStyle"
          >
            <template #header>
              <SrGradientLegend
                class="chart-overlay"
                v-if="computedDataKey != 'solid'"
                :reqId="reqId"
                :transparentBackground="true"
              />
            </template>
          </Dialog>
        </div>
      </div>
    </div>
    <div class="sr-time-series-cntrl">
      <SrCustomTooltip ref="tooltipRef" id="'timeSeriesPlotTooltip'" />
      <div class="plot-tooltip-checkbox-group">
        <Checkbox
          v-model="globalChartStore.showPlotTooltip"
          binary
          inputId="plotTooltipCheckbox"
          size="small"
        />
        <label for="plotTooltipCheckbox" class="sr-checkbox-label">Tooltip</label>
      </div>
      <div class="sr-multiselect-container">
        <div class="sr-multiselect-col">
          <SrPlotCntrl v-if="recTreeStore.selectedReqId > 0" :reqId="recTreeStore.selectedReqId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-time-series-container {
  display: block;
}

.chart-wrapper {
  position: relative; /* Allows absolutely-positioned children to overlay */
  width: 100%;
  height: 60vh; /* or whatever size you want */
  margin: 0rem;
  padding: 0rem;
}

:deep(.p-dialog-mask .p-dialog.p-component.sr-floating-dialog) {
  position: absolute;
  top: 50%;
  left: 50%;
  /* transform: translate(-50%, -50%); */
  background-color: 'rgba(255, 255, 255, 0)';
  color: var(--p-text-color);
  border-radius: var(--p-border-radius);
  margin: 0rem;
  border-width: 0px;
  border-color: transparent;
}

:deep(.p-dialog-mask .p-dialog-content) {
  margin: 0rem;
  padding: 0rem;
}

:deep(.p-dialog-mask .p-dialog-header) {
  margin: 0rem;
  padding: 0rem;
}

.time-series-chart {
  height: 60vh;
  margin: 0.5rem;
}

.sr-scatter-plot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

.sr-time-series-cntrl {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: left;
  margin: 0.5rem;
  padding: 1rem;
  overflow-y: auto;
  overflow-x: auto;
  width: auto;
}
.sr-time-series-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: left;
  margin: 0rem;
  padding: 0rem;
  overflow-y: auto;
  overflow-x: auto;
  height: 100%;
  width: auto;
}
.sr-legends-panel {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}

.sr-cycles-legend-panel {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  margin: 0.5rem;
  padding: 0.5rem;
  width: auto;
}

.sr-select-lists {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  margin: 0.5rem;
  padding: 0.5rem;
  width: auto;
  max-width: 10rem;
}
.sr-select-boxes {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  margin: 0.5rem;
  padding: 0.5rem;
  width: auto;
}
.sr-select-box-hdr {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.25rem;
  padding: 0.25rem;
  width: auto;
  max-width: 10rem;
}
:deep(.sr-listbox-header-title) {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin: 0.25rem;
  padding: 0.25rem;
  font-weight: bold;
  color: var(--p-text-color);
  border-radius: var(--p-border-radius);
}
:deep(.p-listbox-list-container) {
  width: 100%;
  min-width: 5rem;
  max-width: 16rem;
  max-height: 10rem;
  margin: 0.25rem;
}
:deep(.p-listbox-option) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.25rem;
}

:deep(.p-listbox-header) {
  padding: 0.125rem;
  margin: 0.125rem;
  text-align: center;
}

:deep(.p-listbox-list-wrapper) {
  /* A fixed width or max-width is usually necessary to force scrolling */
  max-width: 20rem;
  /* or use width: 300px; if you prefer a fixed width */

  overflow-x: auto; /* enable horizontal scrolling */
  white-space: nowrap; /* prevent list items from wrapping to the next line */
}

/* Ensure list items stay side-by-side horizontally */
:deep(.p-listbox-list) {
  display: inline-flex; /* horizontally place <li> elements in a row */
  flex-wrap: nowrap; /* no wrapping */
  padding: 0; /* optional, just to reduce default padding */
  margin: 0; /* optional, just to reduce default margin */
}

:deep(.p-listbox-item) {
  /* Each item should not flex to fill the container, so prevent auto stretching: */
  flex: 0 0 auto;
  /* Or use: display: inline-block; */
  white-space: nowrap; /* Make sure each items text doesnt wrap within itself */
}

.sr-multiselect-container {
  display: flex;
  flex-wrap: wrap; /* Allow items to wrap to the next line if needed */
  justify-content: flex-start; /* All items are packed toward the start of the main axis */
  align-items: flex-start; /* Align items at the start */
  width: 100%;
  margin: 0.25rem 0;
  gap: 1rem; /* Consistent spacing between items */
}

.sr-multiselect-col {
  flex: 1 1 45%; /* Allow columns to take up 45% of the container width */
  min-width: 10rem; /* 300px equivalent */
  max-width: 16rem; /* 500px equivalent */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch; /* Stretch items to match the width */
  margin: 0.25rem;
}

.sr-multiselect-col-req {
  flex: 1 1 45%; /* Allow columns to take up 45% of the container width */
  min-width: 10rem; /* 300px equivalent */
  max-width: 25rem; /* 500px equivalent */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch; /* Stretch items to match the width */
  margin: 0.25rem;
}
fieldset {
  word-wrap: break-word; /* Break long words */
  white-space: normal; /* Allow wrapping */
}

@media (max-width: 48rem) {
  /* 768px equivalent */
  .sr-multiselect-col {
    flex: 1 1 100%; /* Take up full width on small screens */
    margin: 0.5rem 0;
  }
}

.loading-indicator {
  margin-left: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  color: #ffcc00; /* Yellow color */
}

.message {
  margin-left: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
}

.message-red {
  color: #ff0000; /* Red color */
}

.message-yellow {
  color: #ffcc00; /* Yellow color */
}

.time-series-chart {
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  max-height: 50rem;
  max-width: 80rem;
}

/* Custom toolbar replacing ECharts toolbox (which causes rendering issues with large datasets) */
.sr-chart-toolbar {
  position: absolute;
  left: 0.25rem;
  top: 3rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 10;
  background-color: rgba(30, 30, 30, 0.7);
  border-radius: 0.25rem;
  padding: 0.25rem;
}

.sr-chart-toolbar :deep(.p-button) {
  width: 2rem;
  height: 2rem;
  color: #aaa;
}

.sr-chart-toolbar :deep(.p-button:hover) {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

/* Zoom mode overlay - captures mouse events on top of chart */
.sr-zoom-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 99;
  background: transparent;
}

/* Zoom selection rectangle styles */
.sr-zoom-select-rect {
  position: absolute;
  border: 2px dashed var(--p-primary-color);
  background-color: rgba(100, 149, 237, 0.15);
  pointer-events: none;
  z-index: 100;
}

/* Highlight active zoom select button */
.sr-zoom-select-active {
  background-color: var(--p-primary-color) !important;
  color: var(--p-primary-contrast-color) !important;
}

/* Change cursor when zoom select mode is active */
.chart-wrapper.sr-zoom-mode {
  cursor: crosshair;
}

/* Prevent text selection while drawing zoom rectangle */
.chart-wrapper.sr-zoom-mode * {
  user-select: none;
}

.plot-tooltip-checkbox-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 0.5rem;
}

.sr-checkbox-label {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}
</style>
