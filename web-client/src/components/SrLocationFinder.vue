<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import type OLMap from 'ol/Map.js'
import { fromLonLat } from 'ol/proj'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { containsCoordinate } from 'ol/extent'
import { getScrollableAncestors } from '@/utils/SrMapUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrLocationFinder')

const props = defineProps<{
  map: OLMap | null
}>()

const globalChartStore = useGlobalChartStore()
let highlightEl: HTMLDivElement | null = null
let scrollTimeout: number | undefined

function updatePosition(lat: number, lon: number) {
  if (!props.map || !highlightEl) return

  // Hide marker if coordinates are invalid (NaN signals hover ended)
  if (!isFinite(lat) || !isFinite(lon)) {
    hideMarker()
    return
  }

  const view = props.map.getView()
  if (!view) return

  const projection = view.getProjection()
  const projectionCode = projection.getCode()
  const coord = fromLonLat([lon, lat], projectionCode)

  // ✅ Check if coordinate is within the current extent
  const extent = view.calculateExtent(props.map.getSize())
  if (!containsCoordinate(extent, coord)) {
    highlightEl.style.left = '-9999px'
    highlightEl.style.top = '-9999px'
    return
  }

  const pixel = props.map.getPixelFromCoordinate(coord)
  if (!pixel) return

  const [x, y] = pixel
  const mapRect = props.map.getTargetElement().getBoundingClientRect()
  const globalX = mapRect.left + x
  const globalY = mapRect.top + y

  highlightEl.style.left = `${globalX}px`
  highlightEl.style.top = `${globalY}px`

  highlightEl.classList.add('active')
  setTimeout(() => {
    if (highlightEl) {
      highlightEl.classList.remove('active')
    }
  }, 1000)

  //console.log('Highlight marker fixed position (body):', { globalX, globalY });
}

function hideMarker() {
  if (!highlightEl) return

  highlightEl.style.left = '-9999px'
  highlightEl.style.top = '-9999px'
  highlightEl.classList.remove('active')
}

const handleScroll = () => {
  //console.log('Scroll event detected, hiding marker enabled?:', globalChartStore.enableLocationFinder);
  hideMarker()
  clearTimeout(scrollTimeout)
  scrollTimeout = window.setTimeout(() => {
    if (globalChartStore.enableLocationFinder) {
      updatePosition(globalChartStore.locationFinderLat, globalChartStore.locationFinderLon)
    }
  }, 150) // adjust delay as needed
}

onMounted(() => {
  if (!props.map) return
  //props.map.on('movestart', () => console.log('Map move started'));
  //props.map.on('moveend', () => console.log('Map move ended'));
  //const scrollContainer = document.querySelector('.sliderule-content');
  //scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });

  const mapEl = props.map?.getTargetElement()
  const scrollContainers = getScrollableAncestors(mapEl ?? null)
  //console.log('Scrollable containers:', scrollContainers);

  for (const container of scrollContainers) {
    container.addEventListener('scroll', handleScroll, { passive: true })
  }

  onUnmounted(() => {
    for (const container of scrollContainers) {
      container.removeEventListener('scroll', handleScroll)
    }
  })

  globalChartStore.enableLocationFinder = true
  highlightEl = document.createElement('div')
  highlightEl.className = 'map-highlight-marker'
  document.body.appendChild(highlightEl)

  logger.debug('Highlight marker appended to <body>')
  props.map.on('movestart', hideMarker)
  props.map.on('moveend', () => {
    if (globalChartStore.enableLocationFinder) {
      updatePosition(globalChartStore.locationFinderLat, globalChartStore.locationFinderLon)
    }
  })

  watch(
    () => globalChartStore.enableLocationFinder,
    (enabled) => {
      if (!highlightEl) return
      if (enabled) {
        updatePosition(globalChartStore.locationFinderLat, globalChartStore.locationFinderLon)
      } else {
        highlightEl.style.left = '-9999px'
        highlightEl.style.top = '-9999px'
      }
    },
    { immediate: true }
  )

  watch(
    () => [globalChartStore.locationFinderLat, globalChartStore.locationFinderLon],
    ([lat, lon]) => {
      if (globalChartStore.enableLocationFinder) {
        updatePosition(lat, lon)
      }
    }
  )
})

onUnmounted(() => {
  if (highlightEl) {
    highlightEl.remove()
    highlightEl = null
  }
  props.map?.un('movestart', hideMarker)
  props.map?.un('moveend', hideMarker)
  window.removeEventListener('scroll', handleScroll)
  clearTimeout(scrollTimeout)
})
</script>

<template>
  <div></div>
</template>

<style>
/* using !important instead of :deep because we had to append marker to the <body> */
.map-highlight-marker {
  position: fixed !important;
  width: 8px !important;
  height: 8px !important;
  border-radius: 50% !important;
  background: rgba(255, 0, 0, 0.8) !important;
  border: 2px solid var(--p-primary-400) !important;
  pointer-events: none !important;
  transform: translate(-50%, -50%) !important;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
  z-index: 999999 !important;
}

.map-highlight-marker.active {
  transform: translate(-50%, -50%) scale(3) !important;
  opacity: 1 !important;
}
</style>
