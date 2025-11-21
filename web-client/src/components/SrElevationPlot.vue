<script setup lang="ts">
import { use } from 'echarts/core'
import ToggleButton from 'primevue/togglebutton'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import { CustomChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent
} from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'
import { provide, watch, onMounted, onUnmounted, ref, computed } from 'vue'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import { useChartStore } from '@/stores/chartStore'
import { useRequestsStore } from '@/stores/requestsStore'
import {
  getPhotonOverlayRunContext,
  initializeColorEncoding,
  initSymbolSize,
  callPlotUpdateDebounced,
  setTooltipContentCallback
} from '@/utils/plotUtils'
import SrRunControl from '@/components/SrRunControl.vue'
import { processRunSlideRuleClicked } from '@/utils/workerDomUtils'
import { initDataBindingsToChartStore } from '@/utils/plotUtils'
import { useRecTreeStore } from '@/stores/recTreeStore'
import SrPlotCntrl from './SrPlotCntrl.vue'
import { useAutoReqParamsStore } from '@/stores/reqParamsStore'
import SrGradientLegend from '@/components/SrGradientLegend.vue'
import SrSolidColorLegend from './SrSolidColorLegend.vue'
import SrReqDisplay from './SrReqDisplay.vue'
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { useAnalysisMapStore } from '@/stores/analysisMapStore'
import SrAtl03CnfColors from '@/components/SrAtl03CnfColors.vue'
import SrAtl08Colors from '@/components/SrAtl08Colors.vue'
import SrAtl24Colors from './SrAtl24Colors.vue'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import Dialog from 'primevue/dialog'
import type { AppendToType } from '@/types/SrTypes'
import { processSelectedElPnt } from '@/utils/SrMapUtils'
import SrCycleSelect from '@/components/SrCycleSelect.vue'
import SrSimpleYatcCntrl from './SrSimpleYatcCntrl.vue'
import ProgressSpinner from 'primevue/progressspinner'
import Panel from 'primevue/panel'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import Checkbox from 'primevue/checkbox'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrElevationPlot')

const tooltipRef = ref()
const currentTooltipContent = ref<string>('')
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

const props = defineProps({
  startingReqId: {
    type: Number,
    default: 0
  }
})

const requestsStore = useRequestsStore()
const chartStore = useChartStore()
const globalChartStore = useGlobalChartStore()
const atlChartFilterStore = useAtlChartFilterStore()
const recTreeStore = useRecTreeStore()
const analysisMapStore = useAnalysisMapStore()
const fieldNameStore = useFieldNameStore()
const loadingComponent = ref(true)
const dialogsInitialized = ref(false) // Track if dialogs have been initialized

use([
  CanvasRenderer,
  ScatterChart,
  CustomChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent
])

provide(THEME_KEY, 'dark')
const plotRef = ref<InstanceType<typeof VChart> | null>(null)
const chartWrapperRef = ref<AppendToType>(undefined)
const webGLSupported = ref<boolean>(!!window.WebGLRenderingContext) // Should log `true` if WebGL is supported
const chartReady = ref(false)

const mainLegendDialogStyle = ref<{
  position: string
  top: string
  left: string
  transform?: string // Optional property
}>({
  position: 'absolute',
  top: '0px',
  left: '0px',
  transform: 'translate(-50%, -50%)' // Initially set, removed on drag
})

const overlayLegendDialogStyle = ref<{
  position: string
  top: string
  left: string
  transform?: string // Optional property
}>({
  position: 'absolute',
  top: '0px',
  left: '0px',
  transform: 'translate(-50%, -50%)' // Initially set, removed on drag
})

const initMainLegendPosition = () => {
  const thisChartWrapper = document.querySelector('.chart-wrapper') as HTMLElement
  if (thisChartWrapper) {
    const rect = thisChartWrapper.getBoundingClientRect()
    globalChartStore.scrollX = window.scrollX
    globalChartStore.scrollY = window.scrollY
    // Convert rem to pixels (1rem = 16px by default)
    const middleHorizontalOffset = rect.width / 2 // n rem from the left
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

    // console.log('SrElevationPlot initMainLegendPosition:', {
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
    //});

    mainLegendDialogStyle.value = {
      position: 'absolute',
      top: top,
      left: left,
      transform: 'none' // Remove centering transformation
    }
  } else {
    logger.warn('initMainLegendPosition: thisChartWrapper is null')
  }
}

const initOverlayLegendPosition = () => {
  const thisChartWrapper = document.querySelector('.chart-wrapper') as HTMLElement
  if (thisChartWrapper) {
    const rect = thisChartWrapper.getBoundingClientRect()
    globalChartStore.scrollX = window.scrollX
    globalChartStore.scrollY = window.scrollY
    // Convert rem to pixels (1rem = 16px by default)
    const middleHorizontalOffset = rect.width / 2 // n rem from the left
    const assumedTitleWidth =
      globalChartStore.titleOfElevationPlot.length * globalChartStore.fontSize
    const endOfTitle = rect.left + middleHorizontalOffset + assumedTitleWidth / 2
    const spaceSize = rect.right - endOfTitle
    const centerOfLegend = endOfTitle + spaceSize / 2
    const assumedLegendWidth = assumedTitleWidth // They are about the same cefgw
    const leftLegendOffset = centerOfLegend - assumedLegendWidth / 2
    const left = `${leftLegendOffset}px`

    const topOffset = 3 * globalChartStore.fontSize // n rem from the top
    const top = `${rect.top + topOffset}px`

    // console.log('SrElevationPlot initOverlayLegendPosition:', {
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

    overlayLegendDialogStyle.value = {
      position: 'absolute',
      top: top,
      left: left,
      transform: 'none' // Remove centering transformation
    }
  } else {
    logger.warn('initOverlayLegendPosition: thisChartWrapper is null')
  }
}
const reqId = computed(() => recTreeStore.selectedReqId)

const overlayReqId = computed(() => {
  if (atlChartFilterStore.selectedOverlayedReqIds.length > 0) {
    return atlChartFilterStore.selectedOverlayedReqIds[0]
  }
  return 0
})

const shouldDisplayAtl03Colors = computed(() => {
  // Wait for tree to load before checking API
  if (!recTreeStore.isTreeLoaded) return false

  let shouldDisplay = false
  if (
    recTreeStore.findApiForReqId(reqId.value).includes('atl03') &&
    chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr) === 'atl03_cnf'
  ) {
    shouldDisplay = true
  } else {
    if (atlChartFilterStore.selectedOverlayedReqIds.length > 0) {
      const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString()
      if (reqIdStr) {
        shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl03_cnf'
      }
    }
  }
  return shouldDisplay
})
const shouldDisplayAtl08Colors = computed(() => {
  // Wait for tree to load before checking API
  if (!recTreeStore.isTreeLoaded) return false

  let shouldDisplay = false
  if (
    recTreeStore.findApiForReqId(reqId.value).includes('atl03') &&
    chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr) === 'atl08_class'
  ) {
    shouldDisplay = true
  } else {
    if (atlChartFilterStore.selectedOverlayedReqIds.length > 0) {
      const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString()
      if (reqIdStr) {
        shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl08_class'
      }
    }
  }
  return shouldDisplay
})

const shouldDisplayAtl24Colors = computed(() => {
  // Wait for tree to load before checking API
  if (!recTreeStore.isTreeLoaded) return false

  let shouldDisplay = false
  if (
    recTreeStore.findApiForReqId(reqId.value).includes('atl03') &&
    chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr) === 'atl24_class'
  ) {
    shouldDisplay = true
  } else {
    if (atlChartFilterStore.selectedOverlayedReqIds.length > 0) {
      const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString()
      if (reqIdStr) {
        shouldDisplay = chartStore.getSelectedColorEncodeData(reqIdStr) === 'atl24_class'
      }
    }
  }
  return shouldDisplay
})

// Safely resolve the current color-encode key (fallback to 'solid')
const computedDataKey = computed(() => {
  const key = selectedReqIdStr.value
  if (!key) return 'solid'
  // Prefer the store getter (it can guard internally)
  return chartStore.getSelectedColorEncodeData(key) ?? 'solid'
})

// Safely read useSelectedMinMax (fallback to false)
// Prefer startingReqId if provided, otherwise fall back to the selected one
const useSelectedMinMax = computed(() => {
  const key =
    props.startingReqId && props.startingReqId > 0
      ? String(props.startingReqId)
      : selectedReqIdStr.value

  return chartStore.stateByReqId?.[key]?.useSelectedMinMax ?? false
})

const shouldDisplayMainGradient = computed(() => {
  let shouldDisplay = false
  if (
    (!useSelectedMinMax.value &&
      computedDataKey.value != 'solid' &&
      computedDataKey.value != 'atl08_class' &&
      computedDataKey.value != 'atl03_cnf' &&
      computedDataKey.value != 'atl24_class') ||
    useSelectedMinMax.value
  ) {
    shouldDisplay = true
  }
  return shouldDisplay
})

const mission = computed(() => {
  return fieldNameStore.getMissionForReqId(reqId.value)
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

const shouldDisplayGradientDialog = computed(() => {
  return shouldDisplayOverlayGradient.value || shouldDisplayMainGradient.value
})

const shouldDisplayMainSolidColorLegend = computed(() => {
  return computedDataKey.value === 'solid' && !isAtl24WithPhotonCloud.value
})

const reqIdStr = computed(() => {
  return recTreeStore.selectedReqIdStr || ''
})

const computedOverlayDataKey = computed(() => {
  if (atlChartFilterStore.selectedOverlayedReqIds.length > 0) {
    const reqIdStr = atlChartFilterStore.selectedOverlayedReqIds[0].toString()
    if (reqIdStr) {
      return chartStore.getSelectedColorEncodeData(reqIdStr)
    }
  }
  return ''
})

const shouldDisplayOverlayGradient = computed(() => {
  return (
    atlChartFilterStore.selectedOverlayedReqIds.length > 0 &&
    computedOverlayDataKey.value != '' &&
    computedOverlayDataKey.value != 'solid' &&
    computedOverlayDataKey.value != 'atl03_cnf' &&
    computedOverlayDataKey.value != 'atl08_class' &&
    computedOverlayDataKey.value != 'atl24_class'
  )
})

const isAtl24WithPhotonCloud = computed(() => {
  // hack needed until server supports both heights
  return (
    atlChartFilterStore.selectedOverlayedReqIds.length > 0 &&
    recTreeStore.selectedApi.includes('atl24')
  )
})

const PC_OnTooltip = computed(() => {
  return globalChartStore.use_y_atc_filter
    ? 'Disabled when off pointing filter in ON'
    : 'Click to display Atl03 Photon Cloud'
})

const photonCloudBtnTooltip = computed(() => {
  if (analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading) {
    return 'Photon Cloud is disabled while record is loading'
  } else {
    if (recTreeStore.selectedApi.includes('atl13x')) {
      return 'Photon Cloud is disabled for now for ATL13x requests; support is coming soon'
    }
    return atlChartFilterStore.showPhotonCloud ? 'Click to hide photon cloud' : PC_OnTooltip.value
  }
})

const handleChartFinished = () => {
  if (chartWrapperRef.value) {
    //console.log('handleChartFinished ECharts update finished event -- dialogsInitialized.value:', dialogsInitialized.value, 'chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length:',chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length);
    if (
      dialogsInitialized.value == false &&
      chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0
    ) {
      logger.debug('handleChartFinished: initializing dialogs')
      initMainLegendPosition()
      initOverlayLegendPosition()
      chartReady.value = true
      dialogsInitialized.value = true // Mark dialogs as initialized
    }
  } else {
    logger.warn('handleChartFinished: chartWrapperRef is null')
  }
}

// Save tooltip content as text file
function saveTooltipAsText() {
  if (!currentTooltipContent.value) {
    logger.warn('No tooltip content to save')
    return
  }

  try {
    const blob = new Blob([currentTooltipContent.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    a.download = `plot_tooltip_${timestamp}.txt`

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.debug('Tooltip saved successfully')
  } catch (error) {
    logger.error('Error saving tooltip', { error })
  }
}

// Handle context menu event
function handleContextMenu(event: MouseEvent) {
  // Only show menu if we have tooltip content
  if (currentTooltipContent.value) {
    event.preventDefault()
    contextMenuPosition.value = { x: event.clientX, y: event.clientY }
    showContextMenu.value = true
  }
}

// Close context menu
function closeContextMenu() {
  showContextMenu.value = false
}

// Handle save and close menu
function handleSaveTooltip() {
  saveTooltipAsText()
  closeContextMenu()
}

// Normalize the currently selected reqId ('' when not ready yet)
const selectedReqIdStr = computed(() => {
  const id = recTreeStore.selectedReqId
  return id && id > 0 ? String(id) : ''
})

async function initPlot() {
  logger.debug('initPlot: webGLSupported', { webGLSupported: !!window.WebGLRenderingContext })
  try {
    // Get the computed style of the document's root element
    // Extract the font size from the computed style
    // Log the font size to the console
    //console.log(`onMounted Current root globalChartStore.fontSize: ${globalChartStore.fontSize} recTreeStore.selectedReqId:`, recTreeStore.selectedReqId);
    globalChartStore.use_y_atc_filter = false
    atlChartFilterStore.setIsWarning(true)
    atlChartFilterStore.setMessage('Loading...')
    atlChartFilterStore.showPhotonCloud = false
    atlChartFilterStore.setSelectedOverlayedReqIds([])
    const sReqId = props.startingReqId
    if (sReqId > 0) {
      const selectedElRecord = globalChartStore.getSelectedElevationRec()
      //console.log('SrElevationPlot onMounted selectedElRecord:', selectedElRecord);
      if (selectedElRecord) {
        await processSelectedElPnt(selectedElRecord) // TBD maybe no await here to run in parallel?
      } else {
        logger.warn('onMounted: selectedElRecord is null, nothing to plot yet')
      }
      initializeColorEncoding(sReqId)
    } else {
      logger.warn('reqId is undefined')
    }
  } catch (error) {
    logger.error('Error initializing plot', {
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    // Final setup after initialization
  }
}

onMounted(async () => {
  try {
    //console.log('SrElevationPlot onMounted initial chartWrapperRef:',chartWrapperRef.value);
    webGLSupported.value = !!window.WebGLRenderingContext // Should log `true` if WebGL is supported
    globalChartStore.titleOfElevationPlot = ' Highlighted Track(s)'

    // Set up tooltip content callback
    setTooltipContentCallback((text: string) => {
      currentTooltipContent.value = text
    })

    await initPlot()
    //enableTouchDragging(); // this is experimental
    void requestsStore.displayHelpfulMapAdvice('Legends are draggable to any location')
  } catch (error) {
    logger.error('Error during onMounted initialization', {
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    loadingComponent.value = false
  }
})

onUnmounted(() => {
  logger.debug('SrElevationPlot onUnmounted')
  // Clean up tooltip callback
  setTooltipContentCallback(null)
  // Clean up context menu event listener
  document.removeEventListener('click', closeContextMenu)
})

watch(
  () => plotRef.value,
  async (newValue, oldValue) => {
    if (!newValue) {
      logger.warn('watch plotRef.value: newValue is null or undefined', { oldValue })
      return
    }

    // Cast to expose .chart, and safely access .value
    const chartInstance = (newValue as InstanceType<typeof VChart>).chart

    if (chartInstance) {
      // chartInstance is type EChartsType, NOT a ref
      chartInstance.on('restore', () => {
        void (async () => {
          logger.debug('Zoom or settings were reset')
          atlChartFilterStore.resetZoom()
          dialogsInitialized.value = false // Reset dialogsInitialized to false to re-initialize dialogs
          await initPlot() // Re-initialize the plot to reset any settings
          if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
            await callPlotUpdateDebounced('from SrElevationPlot watch plotRef.value')
          } else if (recTreeStore.selectedReqIdStr && dialogsInitialized.value) {
            logger.warn('No Y data selected')
          }
        })()
      })

      // Add context menu handler to chart DOM element
      const chartDom = chartInstance.getDom()
      if (chartDom) {
        chartDom.addEventListener('contextmenu', handleContextMenu)
        // Also add click listener to close menu when clicking outside
        document.addEventListener('click', closeContextMenu)
      }

      atlChartFilterStore.setPlotRef(newValue)
      if (chartStore.getSelectedYData(recTreeStore.selectedReqIdStr).length > 0) {
        await callPlotUpdateDebounced('from SrElevationPlot watch plotRef.value')
      } else if (recTreeStore.selectedReqIdStr && dialogsInitialized.value) {
        logger.warn('No Y data selected')
      }
    } else {
      logger.warn('Chart instance not ready yet')
    }
  }
)

const messageClass = computed(() => {
  return {
    message: true,
    'message-red': !atlChartFilterStore.getIsWarning(),
    'message-yellow': atlChartFilterStore.getIsWarning()
  }
})

watch(
  () => atlChartFilterStore.showPhotonCloud,
  async (newShowPhotonCloud, oldShowPhotonCloud) => {
    logger.debug('showPhotonCloud changed', { oldShowPhotonCloud, newShowPhotonCloud })
    if (!loadingComponent.value) {
      if (newShowPhotonCloud) {
        const runContext = await getPhotonOverlayRunContext()
        const parentReqIdStr = runContext.parentReqId.toString()
        const parentFuncStr = recTreeStore.findApiForReqId(runContext.parentReqId)
        if (parentFuncStr === 'atl24x') {
          // initially hide the atl024x because it is a different height datum. This avoids confusion
          chartStore.setInitLegendUnselected(parentReqIdStr, true)
        }
        logger.debug('Photon cloud run context', { runContext, parentFuncStr })
        // atl03sp is decrepcated here so fetch and use atl03x instead even if the old one exists
        const isAtl03sp = recTreeStore.findApiForReqId(runContext.reqId) === 'atl03sp' //because it is deprecated
        if (runContext.reqId <= 0 || isAtl03sp) {
          // need to fetch the data because atl03sp is deprecated
          //console.log('showPhotonCloud runContext.reqId:', runContext.reqId, ' runContext.parentReqId:', runContext.parentReqId, 'runContext.trackFilter:', runContext.trackFilter);
          await useAutoReqParamsStore().presetForScatterPlotOverlay(runContext.parentReqId)
          await processRunSlideRuleClicked(runContext) // worker is started here
          //console.log('SrElevationPlot watch atlChartFilterStore.showPhotonCloud runContext:',runContext, 'reqId:', runContext.reqId, parentReqIdStr, ' parentFuncStr:', parentFuncStr);
          if (runContext.reqId > 0) {
            const thisReqIdStr = runContext.reqId.toString()
            initDataBindingsToChartStore([thisReqIdStr]) //after run gives us a reqId
            chartStore.setSavedColorEncodeData(
              parentReqIdStr,
              chartStore.getSelectedColorEncodeData(parentReqIdStr)
            )
            chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid')
            await initSymbolSize(runContext.reqId) // for new record
            initializeColorEncoding(runContext.reqId, 'atl03x')
            // The worker will now fetch the data from the server
            // and write the opfs file then update
            // the map selected layer and the chart
          } else {
            logger.error(
              'watch atlChartFilterStore.showPhotonCloud: processRunSlideRuleClicked failed'
            )
          }
        } else {
          // we already have the data
          initializeColorEncoding(runContext.reqId, parentFuncStr)
          const sced = chartStore.getSelectedColorEncodeData(parentReqIdStr)
          //console.log('sced:', sced, ' reqIdStr:', parentReqIdStr);
          chartStore.setSavedColorEncodeData(parentReqIdStr, sced)
          chartStore.setSelectedColorEncodeData(parentReqIdStr, 'solid')
          await prepareDbForReqId(runContext.reqId)
          await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud TRUE')
        }
        const msg = `Click 'Hide Photon Cloud Overlay' to remove highlighted track Photon Cloud data from the plot`
        requestsStore.setConsoleMsg(msg)
      } else {
        chartStore.setInitLegendUnselected(recTreeStore.selectedReqIdStr, false)
        //console.log(`calling chartStore.getSavedColorEncodeData(${recTreeStore.selectedReqIdStr})`)
        const sced = chartStore.getSavedColorEncodeData(recTreeStore.selectedReqIdStr)
        //console.log(`called chartStore.getSavedColorEncodeData(${recTreeStore.selectedReqIdStr}) sced:${sced}`)
        if (sced && sced != 'unset') {
          //console.log('Restoring to sced:', sced, ' reqIdStr:', recTreeStore.selectedReqIdStr);
          chartStore.setSelectedColorEncodeData(recTreeStore.selectedReqIdStr, sced)
          chartStore.setSavedColorEncodeData(recTreeStore.selectedReqIdStr, 'unset')
        }
        //console.log('SrElevationPlot handlePhotonCloudChange - showPhotonCloud FALSE');
        atlChartFilterStore.setSelectedOverlayedReqIds([])
        await callPlotUpdateDebounced('from watch atlChartFilterStore.showPhotonCloud FALSE')
      }
    } else {
      logger.warn('Skipped handlePhotonCloudChange: Loading component is still active')
    }
  }
)

watch(
  () => atlChartFilterStore.showSlopeLines,
  async (newValue) => {
    logger.debug('Slope Lines visibility changed', {
      newValue,
      showSlopeLines: atlChartFilterStore.showSlopeLines
    })
    // Handle the change in slope lines visibility
    await callPlotUpdateDebounced('from watch atlChartFilterStore.showSlopeLines')
  }
)
</script>
<template>
  <div class="sr-elevation-plot-container" v-if="loadingComponent">
    <span>Filtered Data is Loading...</span>
    <br />
    <ProgressSpinner
      class="sr-spinner"
      animationDuration=".75s"
      style="width: 2rem; height: 2rem"
      strokeWidth="8"
      fill="var(--p-primary-300)"
    />
  </div>
  <div class="sr-elevation-plot-container" v-else>
    <!-- {{ webGLSupported ? 'WebGL is supported' : 'WebGL is not supported' }} -->
    <!-- {{ shouldDisplayMainGradient ? 'Main Gradient Displayed' : 'Main Gradient Not Displayed' }} -->
    <!-- {{  computedDataKey }} -->
    <!-- {{ shouldDisplayMainSolidColorLegend ? 'Main Solid Color Legend Displayed' : 'Main Solid Color Legend Not Displayed' }} -->
    <!-- {{ shouldDisplayOverlayGradient ? 'Overlay Gradient Displayed' : 'Overlay Gradient Not Displayed' }} -->
    <!-- {{ shouldDisplayAtl08Colors ? 'Atl08 Colors Displayed' : 'Atl08 Colors Not Displayed' }} -->
    <!-- {{ shouldDisplayAtl03Colors ? 'Atl03 Colors Displayed' : 'Atl03 Colors Not Displayed' }} -->
    <!-- <div style="background: yellow; color: black; padding: 0.5rem; margin: 0.5rem;">
      DEBUG: shouldDisplayOverlayGradient: {{ shouldDisplayOverlayGradient }} |
      shouldDisplayMainGradient: {{ shouldDisplayMainGradient }} |
      computedOverlayDataKey: {{ computedOverlayDataKey }} |
      computedDataKey: {{ computedDataKey }} |
      overlayedReqIds: {{ atlChartFilterStore.selectedOverlayedReqIds }}
    </div> -->
    <div class="sr-elevation-plot-content">
      <div ref="chartWrapperRef" class="chart-wrapper">
        <v-chart
          ref="plotRef"
          class="scatter-chart"
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
        <!-- Custom context menu for tooltip -->
        <div
          v-if="showContextMenu"
          class="tooltip-context-menu"
          :style="{
            position: 'fixed',
            left: contextMenuPosition.x + 'px',
            top: contextMenuPosition.y + 'px'
          }"
          @click.stop
        >
          <div class="context-menu-item" @click="handleSaveTooltip">Save Tooltip as Text...</div>
        </div>
      </div>
      <div class="sr-cycles-legend-panel">
        <Panel
          v-show="globalChartStore.use_y_atc_filter"
          header="Off Pointing Cntrl"
          :toggleable="true"
          :collapsed="false"
        >
          <SrCycleSelect :label="cyclesLabel" />
          <SrSimpleYatcCntrl />
        </Panel>

        <div class="sr-legends-panel">
          <Dialog
            v-if="chartWrapperRef !== undefined"
            v-model:visible="shouldDisplayGradientDialog"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            :appendTo="chartWrapperRef"
            :style="mainLegendDialogStyle"
          >
            <template #header>
              <SrGradientLegend
                class="chart-overlay"
                v-if="shouldDisplayMainGradient"
                :reqId="reqId"
                :transparentBackground="true"
              />
            </template>
          </Dialog>
          <Dialog
            v-if="chartWrapperRef !== undefined"
            v-model:visible="shouldDisplayMainSolidColorLegend"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            :appendTo="chartWrapperRef"
            :style="mainLegendDialogStyle"
          >
            <template #header>
              <SrSolidColorLegend
                class="chart-overlay"
                v-if="shouldDisplayMainSolidColorLegend"
                :reqIdStr="reqIdStr"
                :data_key="computedDataKey"
                :transparentBackground="true"
              />
            </template>
          </Dialog>
          <Dialog
            v-if="chartWrapperRef !== undefined"
            v-model:visible="shouldDisplayOverlayGradient"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            :appendTo="chartWrapperRef"
            :style="overlayLegendDialogStyle"
          >
            <template #header>
              <SrGradientLegend
                class="chart-overlay"
                v-if="shouldDisplayOverlayGradient"
                :isOverlay="true"
                :reqId="overlayReqId"
                :transparentBackground="true"
              />
            </template>
          </Dialog>
          <Dialog
            v-model:visible="shouldDisplayAtl08Colors"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            appendTo="self"
            :style="overlayLegendDialogStyle"
          >
            <template #header>
              <SrAtl08Colors
                :reqIdStr="recTreeStore.selectedReqIdStr"
                class="chart-overlay"
                v-if="shouldDisplayAtl08Colors"
              />
            </template>
          </Dialog>
          <Dialog
            v-model:visible="shouldDisplayAtl03Colors"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            appendTo="self"
            :style="overlayLegendDialogStyle"
          >
            <template #header>
              <SrAtl03CnfColors
                :reqIdStr="recTreeStore.selectedReqIdStr"
                class="chart-overlay"
                v-if="shouldDisplayAtl03Colors"
              />
            </template>
          </Dialog>
          <Dialog
            v-model:visible="shouldDisplayAtl24Colors"
            :closable="false"
            :draggable="true"
            :modal="false"
            class="sr-floating-dialog"
            appendTo="self"
            :style="overlayLegendDialogStyle"
          >
            <template #header>
              <SrAtl24Colors
                :reqIdStr="recTreeStore.selectedReqIdStr"
                class="chart-overlay"
                v-if="shouldDisplayAtl24Colors"
              />
            </template>
          </Dialog>
        </div>
      </div>
    </div>
    <div class="sr-elevation-plot-cntrl">
      <div v-if="atlChartFilterStore.isLoading" class="loading-indicator">Loading...</div>
      <div
        v-if="atlChartFilterStore.getShowMessage() && mission === 'ICESat-2'"
        :class="messageClass"
      >
        {{ atlChartFilterStore.getMessage() }}
      </div>
      <SrCustomTooltip ref="tooltipRef" id="'elevationPlotTooltip'" />
      <div
        class="sr-run-control"
        v-if="
          mission === 'ICESat-2' &&
          !(recTreeStore.selectedApi === 'atl03x') &&
          !(recTreeStore.selectedApi === 'atl03sp') &&
          !(recTreeStore.selectedApi === 'atl03vp')
        "
      >
        <div
          @mouseover="tooltipRef.showTooltip($event, photonCloudBtnTooltip)"
          @mouseleave="tooltipRef.hideTooltip()"
        >
          <ToggleButton
            v-if="mission === 'ICESat-2'"
            onIcon="pi pi-eye-slash"
            offIcon="pi pi-eye"
            class="sr-show-hide-button"
            v-model="atlChartFilterStore.showPhotonCloud"
            :disabled="
              recTreeStore.selectedApi.includes('atl13x') ||
              analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading ||
              globalChartStore.use_y_atc_filter
            "
            size="small"
            onLabel="Hide Photon Cloud"
            offLabel="Show Photon Cloud"
            rounded
            variant="text"
          >
          </ToggleButton>
        </div>
        <div
          v-if="
            recTreeStore.selectedApi.includes('atl06') ||
            recTreeStore.selectedApi.includes('atl03x-surface')
          "
          class="slope-checkbox-group"
        >
          <Checkbox
            v-if="
              recTreeStore.selectedApi.includes('atl06') ||
              recTreeStore.selectedApi.includes('atl03x-surface')
            "
            v-model="atlChartFilterStore.showSlopeLines"
            binary
            inputId="sslCheckbox"
            size="small"
            :tooltipText="'Show linear fit for each segment'"
          />
          <label
            v-if="
              recTreeStore.selectedApi.includes('atl06') ||
              recTreeStore.selectedApi.includes('atl03x-surface')
            "
            for="sslCheckbox"
            class="sr-checkbox-label"
            >Show linear fit for each segment</label
          >
        </div>
        <SrRunControl :includeAdvToggle="false" buttonLabel="Photon Cloud" />
      </div>
      <div class="sr-multiselect-container">
        <div class="sr-multiselect-col">
          <SrPlotCntrl v-if="reqId > 0 && !isAtl24WithPhotonCloud" :reqId="reqId" />
        </div>
        <div class="sr-multiselect-col">
          <div
            v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds"
            :key="overlayedReqId"
          >
            <SrPlotCntrl :reqId="overlayedReqId" :isOverlay="true" />
          </div>
          <div class="sr-multiselect-col-req">
            <SrReqDisplay
              v-if="
                mission === 'ICESat-2' &&
                atlChartFilterStore.selectedOverlayedReqIds.length === 0 &&
                !(recTreeStore.selectedApi === 'atl03x') &&
                !(recTreeStore.selectedApi === 'atl03sp') &&
                !(recTreeStore.selectedApi === 'atl03vp')
              "
              label="Show Photon Cloud Req Params"
              :isForPhotonCloud="true"
              :tooltipText="'The params that will be used for the Photon Cloud overlay'"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-elevation-plot-container {
  display: block;
}

.chart-wrapper {
  position: relative; /* Allows absolutely-positioned children to overlay */
  width: 100%;
  height: 60vh; /* or whatever size you want */
  margin: 0.25rem;
  padding: 0.25rem;
}

:deep(.p-dialog-mask .p-dialog.p-component.sr-floating-dialog) {
  position: absolute;
  top: 50%;
  left: 50%;
  /* transform: translate(-50%, -50%); */
  background-color: transparent;
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

.sr-elevation-plot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

.sr-elevation-plot-cntrl {
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
.sr-elevation-plot-content {
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

.sr-run-control {
  display: flex;
  flex-direction: row;
  justify-content: flex-start; /* left-aligned, but children can be centered vertically */
  align-items: center; /* <--- this ensures vertical centering */
  gap: 0.125rem; /* or whatever spacing you prefer */
  overflow-y: auto;
  overflow-x: auto;
  width: auto;
  min-width: 10rem;
}

.slope-checkbox-group {
  display: flex;
  flex-direction: row;
  align-items: center; /* vertical centering */
  margin-left: 0rem;
}

.sr-checkbox-label {
  margin-left: 0.5rem;
  font-size: 1rem; /* or match your app's font size */
  cursor: pointer;
}

:deep(.p-togglebutton-icon) {
  color: var(--p-primary-color, white); /* fallback to white */
}

:deep(.p-togglebutton) {
  color: var(--p-primary-color, white); /* fallback to white */
}

.sr-show-hide-button {
  margin: 1rem;
  min-width: 10rem;
  border-radius: 2rem;
}
.sr-show-hide-button:hover {
  border-width: 1px;
  border-color: var(--primary-color);
  box-shadow:
    0 0 12px var(--p-button-primary-border-color),
    0 0 20px var(--p-button-primary-border-color);
  transition: box-shadow 0.3s ease;
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

.scatter-chart {
  height: 60vh;
  width: 100%;
  margin-bottom: 0.5rem;
  margin-left: 0rem;
  margin-right: 0rem;
  margin-top: 0rem;
  margin-bottom: 0rem;
  padding: 0rem;
  max-height: 50rem;
  max-width: 80rem;
}

/* Allow dragging on touch devices */
:deep(.p-dialog) {
  touch-action: none; /* Disable default gestures to allow dragging */
  -webkit-user-drag: none;
  user-select: none;
}

/* Custom context menu styles */
.tooltip-context-menu {
  background-color: #2a2a2a;
  border: 1px solid #555;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  min-width: 180px;
  z-index: 9999;
  padding: 4px 0;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  color: #ffffff;
  font-size: 0.875rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.context-menu-item:hover {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}
</style>
