<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type OLMap from 'ol/Map.js'
import type View from 'ol/View.js'

const props = defineProps<{
  map: OLMap | undefined
}>()

const zoom = ref<string>('N/A')
const center = ref<string>('N/A')
const extent = ref<string>('N/A')
const projection = ref<string>('N/A')

let viewListener: any = null
let currentView: View | null = null
let mapViewChangeListener: any = null

const updateViewState = () => {
  //console.log('SrMapDebugInfo: updateViewState called', { hasMap: !!props.map })
  if (!props.map) return

  const view = props.map.getView()
  const currentZoom = view.getZoom()
  const currentCenter = view.getCenter()
  const currentExtent = view.calculateExtent(props.map.getSize())
  const currentProjection = view.getProjection()?.getCode()

  //console.log('SrMapDebugInfo: View state', { currentZoom, currentCenter, currentProjection })

  if (currentZoom !== undefined) {
    zoom.value = currentZoom.toFixed(4)
  }

  if (currentCenter) {
    center.value = `[${currentCenter.map((c) => c.toFixed(2)).join(', ')}]`
  }

  if (currentExtent) {
    extent.value = `[${currentExtent.map((e) => e.toFixed(2)).join(', ')}]`
  }

  if (currentProjection) {
    projection.value = currentProjection
  }
}

const setupViewListeners = (view: View) => {
  if (!view) return

  // Clean up old listeners if they exist
  if (currentView && viewListener) {
    currentView.un('change:resolution', viewListener)
    currentView.un('change:center', viewListener)
    currentView.un('change', viewListener)
    //console.log('SrMapDebugInfo: Cleaned up old listeners')
  }

  currentView = view
  viewListener = updateViewState

  view.on('change:resolution', viewListener)
  view.on('change:center', viewListener)
  view.on('change', viewListener)
  //console.log('SrMapDebugInfo: Set up event listeners on view')

  // Initial update
  updateViewState()
}

// Watch for map changes
watch(
  () => props.map,
  (newMap, oldMap) => {
    //console.log('SrMapDebugInfo: map watch triggered', { hasMap: !!newMap })

    // Clean up old map listener
    if (oldMap && mapViewChangeListener) {
      oldMap.un('change:view', mapViewChangeListener)
      //console.log('SrMapDebugInfo: Cleaned up map view change listener')
    }

    if (newMap) {
      // Set up initial view listeners
      setupViewListeners(newMap.getView())

      // Listen for view changes on the map (happens when projection changes)
      mapViewChangeListener = () => {
        //console.log('SrMapDebugInfo: Map view changed, setting up new listeners')
        setupViewListeners(newMap.getView())
      }
      newMap.on('change:view', mapViewChangeListener)
      //console.log('SrMapDebugInfo: Set up map view change listener')
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (currentView && viewListener) {
    currentView.un('change:resolution', viewListener)
    currentView.un('change:center', viewListener)
    currentView.un('change', viewListener)
  }
  if (props.map && mapViewChangeListener) {
    props.map.un('change:view', mapViewChangeListener)
  }
})
</script>

<template>
  <div class="sr-map-debug-info">
    <div class="debug-row">
      <span class="debug-label">Zoom:</span>
      <span class="debug-value">{{ zoom }}</span>
    </div>
    <div class="debug-row">
      <span class="debug-label">Center:</span>
      <span class="debug-value">{{ center }}</span>
    </div>
    <div class="debug-row">
      <span class="debug-label">Extent:</span>
      <span class="debug-value">{{ extent }}</span>
    </div>
    <div class="debug-row">
      <span class="debug-label">Projection:</span>
      <span class="debug-value">{{ projection }}</span>
    </div>
  </div>
</template>

<style scoped>
.sr-map-debug-info {
  position: absolute;
  bottom: 6rem;
  left: 0.5rem;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #0f0;
  pointer-events: none;
}

.debug-row {
  display: flex;
  margin-bottom: 0.25rem;
}

.debug-row:last-child {
  margin-bottom: 0;
}

.debug-label {
  font-weight: bold;
  min-width: 80px;
  color: #0ff;
}

.debug-value {
  color: #0f0;
  font-family: 'Courier New', monospace;
}
</style>
