<template>
  <div class="deck-view-container">
    <div ref="localDeckContainer" class="deck-canvas"></div>
  </div>
  <div class="sr-3d-cntrl">
    <Button
      label="Toggle Axes"
      icon="pi pi-eye"
      class="sr-glow-button"
      variant="text"
      rounded
      @click="handleToggleAxes"
    />
    <div>
      <label
        class="sr-y-data-label"
        :for="`srYColEncode3D-overlayed-${recTreeStore.selectedReqIdStr}`"
        >Point Color</label
      >
      <Select
        class="sr-select-col-encode-data"
        v-model="yColorEncodeSelectedReactive[recTreeStore.selectedReqIdStr]"
        :options="
          chartStore.getColorEncodeOptionsForFunc(recTreeStore.selectedReqIdStr, computedFunc)
        "
        @change="handleColorEncodeSelectionChange"
        placeholder="Encode Color with"
        :id="`srYColEncode3D-overlayed-${recTreeStore.selectedReqIdStr}`"
        size="small"
      >
      </Select>
      <SrGradientLegend
        v-if="reqId > 0"
        class="chart-overlay"
        :reqId="reqId"
        :transparentBackground="true"
      />
    </div>
    <div>
      <label class="sr-pnt-sz-label" for="pointSizeId">Point Size</label>
      <InputNumber
        v-model="deck3DConfigStore.pointSize"
        inputId="pointSizeId"
        size="small"
        :step="0.1"
        :min="0.1"
        :max="10.0"
        :minFractionDigits="0"
        :maxFractionDigits="1"
        showButtons
        :defaultValue="deck3DConfigStore.pointSize"
        @value-change="handlePointSizeChange"
      />
    </div>
    <div>
      <label class="sr-vert-exag-label" for="vertExagId">Vertical Exaggeration</label>
      <InputNumber
        v-model="deck3DConfigStore.verticalExaggeration"
        inputId="vertExagId"
        size="small"
        :step="computedStepSize"
        :min="1"
        :max="1000000"
        showButtons
        @update:model-value="handleVerticalExaggerationChange"
      />
    </div>
  </div>
  <SrDeck3DCfg />
</template>

<script setup lang="ts">
import { onMounted, nextTick, computed, watch, ref, onUnmounted } from 'vue'
import SrGradientLegend from '@/components/SrGradientLegend.vue'
import { useSrToastStore } from '@/stores/srToastStore'
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { updateElevationMap } from '@/utils/SrMapUtils'
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore'
import SrDeck3DCfg from '@/components/SrDeck3DCfg.vue'
import Button from 'primevue/button'
import { InputNumber } from 'primevue'
import {
  finalizeDeck,
  loadAndCachePointCloudData,
  updateFovy,
  renderCachedData
} from '@/utils/deck3DPlotUtils'
import { debouncedRender } from '@/utils/SrDebounce'
import { yColorEncodeSelectedReactive } from '@/utils/plotUtils'
import Select from 'primevue/select'
import { useChartStore } from '@/stores/chartStore'
import { checkAndSetFilterFor3D } from '@/utils/plotUtils'
import { createLogger } from '@/utils/logger'
import { useActiveTabStore } from '@/stores/activeTabStore'
import { storeToRefs } from 'pinia'

const logger = createLogger('SrDeck3DView')

const recTreeStore = useRecTreeStore()
const chartStore = useChartStore()
const toast = useSrToastStore()
const deck3DConfigStore = useDeck3DConfigStore()
const reqId = computed(() => recTreeStore.selectedReqId)
const elevationStore = useElevationColorMapStore()
const computedFunc = computed(() => recTreeStore.selectedApi)
const activeTabStore = useActiveTabStore()
const { activeTab } = storeToRefs(activeTabStore)

const localDeckContainer = ref<HTMLDivElement | null>(null)
const resizeObserver = ref<ResizeObserver | null>(null)
const lastCanvasSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })
const windowResizeHandler = ref<(() => void) | null>(null)

const computedStepSize = computed(() => {
  if (deck3DConfigStore.verticalScaleRatio > 1000) {
    // If the vertical scale ratio is very large, increase the step size for better control
    return 100
  } else if (deck3DConfigStore.verticalScaleRatio > 100) {
    // For moderate vertical scale ratios, use a smaller step size
    return 10
  } else if (deck3DConfigStore.verticalScaleRatio > 10) {
    // For smaller vertical scale ratios, use an even smaller step size
    return 5
  } else {
    // For very small vertical scale ratios, use a minimal step size
    return 1
  }
})

async function handleColorEncodeSelectionChange() {
  logger.debug('handleColorEncodeSelectionChange')
  await loadAndCachePointCloudData(reqId.value)
  debouncedRender(localDeckContainer) // Use the fast, debounced renderer
}

function handleToggleAxes() {
  deck3DConfigStore.showAxes = !deck3DConfigStore.showAxes
  debouncedRender(localDeckContainer) // Use the fast, debounced renderer
}

function handlePointSizeChange() {
  //console.log('Point Size Changed:', deck3DConfigStore.pointSize);
  debouncedRender(localDeckContainer) // Use the fast, debounced renderer
}

function handleVerticalExaggerationChange() {
  //console.log('Vertical exaggeration changed:', deck3DConfigStore.verticalExaggeration);
  debouncedRender(localDeckContainer) // Use the fast, debounced renderer
}

function updateFitZoom(width: number, height: number) {
  const minDimension = Math.min(width, height)
  if (minDimension <= 0) {
    logger.warn('updateFitZoom called with non-positive dimensions', { width, height })
    return false
  }

  const newFitZoom = Math.log2(minDimension / deck3DConfigStore.scale)
  if (!Number.isFinite(newFitZoom)) {
    logger.warn('Computed fitZoom is not finite', { newFitZoom, width, height })
    return false
  }

  deck3DConfigStore.fitZoom = newFitZoom
  lastCanvasSize.value = { width, height }
  return true
}

function syncDeckContainerSize(logZeroSize = false) {
  const container = localDeckContainer.value
  if (!container) {
    logger.error('syncDeckContainerSize called with null container')
    return false
  }

  const { width, height } = container.getBoundingClientRect()
  if (width === 0 || height === 0) {
    if (logZeroSize) {
      logger.warn('Deck container currently has zero dimensions', { width, height })
    }
    return false
  }

  deck3DConfigStore.deckContainer = container
  return updateFitZoom(width, height)
}

function observeDeckContainer() {
  if (!localDeckContainer.value || typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver.value = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) {
        continue
      }

      const hasSizeChanged =
        width !== lastCanvasSize.value.width || height !== lastCanvasSize.value.height

      if (!hasSizeChanged && deck3DConfigStore.deckContainer) {
        continue
      }

      if (updateFitZoom(width, height)) {
        deck3DConfigStore.deckContainer = localDeckContainer.value
        debouncedRender(localDeckContainer)
      }
    }
  })

  resizeObserver.value.observe(localDeckContainer.value)
}

function triggerRenderIfSized(logZeroSize = false) {
  if (syncDeckContainerSize(logZeroSize)) {
    debouncedRender(localDeckContainer)
    return true
  }
  return false
}

async function handle3DTabActivated() {
  await nextTick()
  const containerReady = syncDeckContainerSize(true)
  if (containerReady) {
    // Use direct render (not debounced) to ensure immediate update when tab activates
    renderCachedData(localDeckContainer, true)
  } else {
    // Container not ready, try on next frame
    requestAnimationFrame(() => {
      if (syncDeckContainerSize(false)) {
        renderCachedData(localDeckContainer, true)
      }
    })
  }
}

onMounted(async () => {
  //console.log('onMounted SrDeck3DView reqId:', reqId.value);
  await updateElevationMap(reqId.value)
  await nextTick() // ensures DOM is updated
  elevationStore.updateElevationColorMapValues()
  await checkAndSetFilterFor3D()
  await nextTick() // makes sure the gradient is available
  //console.log('onMounted Centroid:', deck3DConfigStore.centroid);
  syncDeckContainerSize(true)
  observeDeckContainer()
  if (typeof window !== 'undefined') {
    const handler = () => {
      if (activeTab.value === '3') {
        triggerRenderIfSized(false)
      }
    }
    window.addEventListener('resize', handler)
    windowResizeHandler.value = handler
  }
  //console.log('onMounted fitZoom:', deck3DConfigStore.fitZoom);
  //console.log('onMounted Deck container size:', deckContainer.value?.getBoundingClientRect());

  if (elevationStore.elevationColorMap.length > 0) {
    //console.log('onMounted calling loadAndCachePointCloudData');
    await loadAndCachePointCloudData(reqId.value)
    debouncedRender(localDeckContainer) // Use the fast, debounced renderer
  } else {
    logger.error('No color Gradient')
    toast.error('No color Gradient', 'Skipping point cloud due to missing gradient.')
  }
  toast.info(
    '3D view',
    'Drag to rotate, scroll to zoom. Hold the shift key and drag to pan.',
    30000
  )
})

onUnmounted(() => {
  //console.log('onUnmounted for SrDeck3DView');
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
    resizeObserver.value = null
  }
  if (typeof window !== 'undefined' && windowResizeHandler.value) {
    window.removeEventListener('resize', windowResizeHandler.value)
    windowResizeHandler.value = null
  }
  finalizeDeck()
})

watch(reqId, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    await checkAndSetFilterFor3D()
    await updateElevationMap(reqId.value)
    await loadAndCachePointCloudData(reqId.value)
    debouncedRender(localDeckContainer) // Use the fast, debounced renderer
  }
})

watch(
  () => deck3DConfigStore.fovy,
  (newFov) => {
    updateFovy(newFov)
    debouncedRender(localDeckContainer) // Use the fast, debounced renderer
  }
)

watch(activeTab, (newTab, oldTab) => {
  if (newTab === '3' && newTab !== oldTab) {
    void handle3DTabActivated()
  }
})
</script>

<style scoped>
.deck-canvas {
  position: relative; /* ✅ ensures canvas stays in scroll flow */
  display: block;
  width: 100%;
  height: 60vh;
  min-height: 400px;
  background: #111;
  /* border: 1px solid #ccc;  */
  overflow: hidden; /* if you want scrollbars */
  will-change: transform; /* Hint for performance */
}
/* Override PrimeVue component widths */
:deep(.p-inputnumber-input) {
  width: 7rem;
}

.sr-3d-cntrl {
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
}
.sr-y-data-label {
  font-size: small;
  margin-right: 0.2rem;
  align-items: center;
  justify-content: center;
}
.sr-pnt-sz-label {
  font-size: small;
  margin-right: 0.2rem;
  align-items: center;
  justify-content: center;
}
.sr-vert-exag-label {
  font-size: small;
  margin-right: 0.2rem;
  align-items: center;
  justify-content: center;
}
.sr-vert-scl-label {
  font-size: small;
  margin-left: 0.5rem;
  margin-right: 0.2rem;
  align-items: center;
  justify-content: center;
}
</style>
