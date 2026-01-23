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
      <label class="sr-pnt-sz-label" for="pointSizeId">Pt Sz</label>
      <InputNumber
        v-model="deck3DConfigStore.pointSize"
        inputId="pointSizeId"
        class="sr-narrow-input"
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
      <label class="sr-vert-exag-label" for="vertExagId">Vert Exag</label>
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
  transformLatLonTo3DWorld,
  is3DDataLoaded,
  isTransformCacheReady
} from '@/utils/deck3DPlotUtils'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { debouncedRender } from '@/utils/SrDebounce'
import { yColorEncodeSelectedReactive } from '@/utils/plotUtils'
import Select from 'primevue/select'
import { useChartStore } from '@/stores/chartStore'
import { checkAndSetFilterFor3D } from '@/utils/plotUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrDeck3DView')

const recTreeStore = useRecTreeStore()
const chartStore = useChartStore()
const toast = useSrToastStore()
const deck3DConfigStore = useDeck3DConfigStore()
const globalChartStore = useGlobalChartStore()
const reqId = computed(() => recTreeStore.selectedReqId)
const elevationStore = useElevationColorMapStore()
const computedFunc = computed(() => recTreeStore.selectedApi)

const localDeckContainer = ref<HTMLDivElement | null>(null)

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

onMounted(async () => {
  await updateElevationMap(reqId.value)
  await nextTick()
  elevationStore.updateElevationColorMapValues()
  void checkAndSetFilterFor3D()
  await nextTick()
  const { width, height } = localDeckContainer.value!.getBoundingClientRect()
  deck3DConfigStore.fitZoom = Math.log2(Math.min(width, height) / deck3DConfigStore.scale)

  if (localDeckContainer.value) {
    const { width, height } = localDeckContainer.value.getBoundingClientRect()
    if (width === 0 || height === 0) {
      logger.error('onMounted Deck container has zero dimensions', { width, height })
    } else {
      deck3DConfigStore.deckContainer = localDeckContainer.value
    }
  }

  if (elevationStore.elevationColorMap.length > 0) {
    await loadAndCachePointCloudData(reqId.value)
    debouncedRender(localDeckContainer)
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
    if (!is3DDataLoaded()) return
    logger.debug('FOV updated', { newFov })
    updateFovy(newFov)
    debouncedRender(localDeckContainer) // Use the fast, debounced renderer
  }
)

// Feature 1: Watch selection changes to update highlighted track in 3D view
watch(
  () => globalChartStore.getSelectedTrackOptions(),
  () => {
    if (!is3DDataLoaded()) return // Guard against render before data is loaded
    // logger.debug('Selection changed, re-rendering 3D view')
    debouncedRender(localDeckContainer)
  },
  { deep: true }
)

// Feature 2: Watch 2D map hover to show marker in 3D view
// Note: Animation removed because debouncedRender causes stuttering.
// Marker is shown at a fixed size (5x point size) for reliability.
const MARKER_SIZE_MULTIPLIER = 5

watch(
  () => [
    globalChartStore.mapHoverLat,
    globalChartStore.mapHoverLon,
    globalChartStore.mapHoverIsSelected
  ],
  ([lat, lon, isSelected]) => {
    if (!isTransformCacheReady()) return // Guard against transform before render completes
    if (
      lat !== null &&
      lon !== null &&
      Number.isFinite(lat as number) &&
      Number.isFinite(lon as number)
    ) {
      // Transform 2D map coordinates to 3D world position
      const worldPos = transformLatLonTo3DWorld(lat as number, lon as number)
      if (worldPos) {
        deck3DConfigStore.hoverMarkerPosition = worldPos
        // Set marker color: blue if on selected track, red if not
        deck3DConfigStore.hoverMarkerColor = isSelected
          ? [0, 0, 255, 255] // Blue for selected track
          : [255, 0, 0, 255] // Red for non-selected track
        // Set fixed size and render
        deck3DConfigStore.hoverMarkerSizeMultiplier = MARKER_SIZE_MULTIPLIER
        debouncedRender(localDeckContainer)
      } else {
        logger.warn('3D marker: transformLatLonTo3DWorld returned null', { lat, lon })
      }
    } else {
      // Hide marker when hover ends
      if (deck3DConfigStore.hoverMarkerPosition !== null) {
        deck3DConfigStore.hoverMarkerPosition = null
        debouncedRender(localDeckContainer)
      }
    }
  }
)

// Watch hover marker position changes (from 3D hover or 2D map hover)
// This ensures the marker layer gets updated when hovering in 3D view
watch(
  () => deck3DConfigStore.hoverMarkerPosition,
  () => {
    if (!is3DDataLoaded()) return
    debouncedRender(localDeckContainer)
  },
  { deep: true }
)
</script>

<style scoped>
.deck-view-container {
  position: relative;
  overflow: visible;
}

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

/* Allow deck.gl tooltips to overflow the container */
:deep(.deck-tooltip) {
  position: fixed !important;
  z-index: 9999 !important;
}

/* Specific styling for 3D view tooltip */
:deep(.deck-3d-tooltip) {
  max-width: 250px !important;
  width: auto !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  white-space: normal !important;
  box-sizing: border-box !important;
}

:deep(.deck-3d-tooltip div) {
  max-width: 100% !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  white-space: normal !important;
  display: block !important;
}

:deep(.deck-3d-tooltip strong),
:deep(.deck-3d-tooltip em) {
  word-break: break-word !important;
  overflow-wrap: break-word !important;
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
.sr-narrow-input {
  width: 5rem;
}
</style>
