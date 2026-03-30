<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import type OLMap from 'ol/Map.js'
import { useToast } from 'primevue/usetoast'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrHelperMap')

import { findSrViewKey } from '@/composables/SrViews'
import { useProjectionNames } from '@/composables/SrProjections'
import { srProjections } from '@/composables/SrProjections'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4.js'
import 'ol-geocoder/dist/ol-geocoder.min.css'
import { useMapStore } from '@/stores/mapStore'
import { useHelperMapStore } from '@/stores/helperMapStore'
import { get as getProjection } from 'ol/proj.js'
import { addLayersForCurrentView } from '@/composables/SrLayers'
import Feature from 'ol/Feature.js'
import DragBox from 'ol/interaction/DragBox.js'
import Draw from 'ol/interaction/Draw.js'
import VectorSource from 'ol/source/Vector.js'
import { Stroke, Style, Fill } from 'ol/style.js'
import {
  enableTagDisplay,
  disableTagDisplay,
  saveMapZoomState,
  canRestoreZoomCenter,
  zoomOutToFullMap,
  updateMapView
} from '@/utils/SrMapUtils'
import type { Coordinate } from 'ol/coordinate.js'
import { type SrRegion } from '@/types/SrTypes'
import { format } from 'ol/coordinate.js'
import SrViewControl from './SrViewControl.vue'
import SrBaseLayerControl from './SrBaseLayerControl.vue'
import SrGraticuleControl from './SrGraticuleControl.vue'
import SrDrawControl from '@/components/SrDrawControl.vue'
import { usePolarOverlay } from '@/composables/usePolarOverlay'
import SrUploadRegionControl from '@/components/SrUploadRegionControl.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { Map, MapControls } from 'vue3-openlayers'
import VectorLayer from 'ol/layer/Vector.js'
import { useDebugStore } from '@/stores/debugStore'
import { useWmsCap } from '@/composables/useWmsCap'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import SrMapDebugInfo from '@/components/SrMapDebugInfo.vue'
import { convexHull, isClockwise, convexHullInProjection } from '@/composables/SrTurfUtils'
import GeoJSON from 'ol/format/GeoJSON.js'
import { toLonLat } from 'ol/proj.js'
import OlOverlay from 'ol/Overlay.js'
import type Overlay from 'ol/Overlay'
import { getArea as geodesicArea } from 'ol/sphere.js'
import Polygon, { fromExtent as polygonFromExtent } from 'ol/geom/Polygon.js'
import { unByKey } from 'ol/Observable.js'
import { findSrView } from '@/composables/SrViews'

const dragAreaEl = document.createElement('div')
dragAreaEl.className = 'ol-measure-hud'
const dragAreaOverlay = ref<Overlay | null>(null)
let polyGeomChangeKey: any = null

function formatArea(m2: number): string {
  if (!isFinite(m2)) return ''
  if (m2 < 1e6) return `${m2.toFixed(0)} m²`
  const km2 = m2 / 1e6
  return `${km2.toFixed(km2 < 10 ? 2 : 1)} km²`
}

const debugStore = useDebugStore()

interface SrDrawControlMethods {
  resetPicked: () => void
}
const srDrawControlRef = ref<SrDrawControlMethods | null>(null)
const mapRef = ref<{ map: OLMap }>()
const mapStore = useMapStore()
const helperStore = useHelperMapStore()
const toast = useToast()
const tooltipRef = ref()
const isDrawing = ref(false)
const drawnPolygonFeature = ref<Feature | null>(null)

// --- Copy dialog state ---
const showCopyDialog = ref(false)
const clipboardText = ref('')
const copied = ref(false)
const rasterize = ref(false)

// Whether the rasterize option should be available (only for freehand polygon, not box)
const canRasterize = computed(() => helperStore.polygonSource === 'polygon')

function updateClipboardText() {
  const text = helperStore.getPolygonForClipboard(rasterize.value)
  if (text) {
    clipboardText.value = text
  }
}

function openCopyDialog() {
  rasterize.value = false
  copied.value = false
  updateClipboardText()
  showCopyDialog.value = true
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(clipboardText.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    logger.error('Failed to copy to clipboard', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// Styles for active/inactive polygon selection
// Raw polygon: red; Convex hull: blue (hullColor)
const rawPolyActiveStyle = new Style({
  stroke: new Stroke({ color: 'rgba(255, 0, 0, 1)', width: 2 }),
  fill: new Fill({ color: 'rgba(255, 0, 0, 0.2)' })
})
const rawPolyInactiveStyle = new Style({
  stroke: new Stroke({ color: 'rgba(255, 0, 0, 0.35)', width: 1, lineDash: [4, 4] })
})
const hullActiveStyle = new Style({
  stroke: new Stroke({ color: 'rgba(0, 0, 255, 1)', width: 2 }),
  fill: new Fill({ color: 'rgba(0, 0, 255, 0.12)' })
})
const hullInactiveStyle = new Style({
  stroke: new Stroke({ color: 'rgba(0, 0, 255, 0.35)', width: 1, lineDash: [4, 4] })
})

function updatePolyStyles(rasterized: boolean) {
  // Update raw polygon feature style
  if (drawnPolygonFeature.value) {
    drawnPolygonFeature.value.setStyle(rasterized ? rawPolyActiveStyle : rawPolyInactiveStyle)
  }
  // Update convex hull features style
  const vectorSource = getDrawingSource()
  if (vectorSource) {
    vectorSource.getFeatures().forEach((f) => {
      const id = f.getId()
      if (typeof id === 'string' && id.startsWith('feature-userDrawn-')) {
        f.setStyle(rasterized ? hullInactiveStyle : hullActiveStyle)
      }
    })
  }
}

// Recompute clipboard text and swap styles when rasterize is toggled
watch(rasterize, (val) => {
  updateClipboardText()
  updatePolyStyles(val)
})

// Watch helperStore.poly — open dialog when a polygon is drawn
watch(
  () => helperStore.poly,
  (newPoly) => {
    if (newPoly && newPoly.length > 0) {
      openCopyDialog()
    }
  }
)

const { addPolarOverlay, removePolarOverlay } = usePolarOverlay({
  latitudeThreshold: 88,
  color: '#FF0000',
  opacity: 0.25,
  zIndex: 100
})

const dragBox = new DragBox()
const drawVectorSource = new VectorSource({ wrapX: false })
const drawVectorLayer = new VectorLayer({
  source: drawVectorSource,
  zIndex: 100
})

const drawPolygon = new Draw({
  source: drawVectorSource,
  type: 'Polygon',
  style: new Style({
    stroke: new Stroke({ color: 'blue', width: 2 }),
    fill: new Fill({ color: 'rgba(255, 0, 0, 0.1)' })
  })
})

// Use helperStore for view/base layer instead of the shared mapStore
const computedProjName = computed(() => {
  return (
    findSrView(helperStore.selectedView, helperStore.selectedBaseLayer).value?.projectionName ||
    'EPSG:3857'
  )
})

const lonlat_template = 'Latitude:{y}\u00B0, Longitude:{x}\u00B0'
const meters_template = 'y:{y}m, x:{x}m'
const stringifyFunc = (coordinate: Coordinate) => {
  const projName = computedProjName.value
  const newProj = getProjection(projName)
  let newCoord = coordinate
  if (!debugStore.useMetersForMousePosition) {
    if (newProj?.getUnits() !== 'degrees') {
      newCoord = toLonLat(coordinate, projName)
    }
    return format(newCoord, lonlat_template, 4)
  } else {
    return format(coordinate, meters_template, 4)
  }
}

function getHelperSrViewObj() {
  return findSrView(helperStore.selectedView, helperStore.selectedBaseLayer).value
}

function getDrawingSource(): VectorSource | null {
  const vectorLayer = mapRef.value?.map
    .getLayers()
    .getArray()
    .find((layer) => layer.get('name') === 'Drawing Layer')
  if (vectorLayer && vectorLayer instanceof VectorLayer) {
    return vectorLayer.getSource()
  }
  return null
}

const boxStyle = new Style({
  stroke: new Stroke({ color: 'red', width: 2 }),
  fill: new Fill({ color: 'rgba(255, 0, 0, 0.1)' })
})

// --- DragBox (Box drawing) ---
function disableDragBox() {
  mapRef.value?.map.removeInteraction(dragBox)
}

function enableDragBox() {
  disableDragBox()
  disableDrawPolygon()
  mapRef.value?.map.addInteraction(dragBox)
  isDrawing.value = true
}

dragBox.on('boxstart', () => {
  const geom = dragBox.getGeometry()
  if (!geom) return
  const extent = geom.getExtent()
  const pos: [number, number] = [extent[2], extent[3]]
  dragAreaEl.textContent = ''
  dragAreaOverlay.value?.setPosition(pos)
})

dragBox.on('boxdrag', () => {
  const map = mapRef.value?.map
  const geom = dragBox.getGeometry()
  if (!map || !geom) return
  const extent = geom.getExtent()
  const poly = polygonFromExtent(extent)
  const m2 = geodesicArea(poly, { projection: map.getView().getProjection() })
  dragAreaEl.textContent = formatArea(Math.abs(m2))
  const pos: [number, number] = [extent[2], extent[3]]
  dragAreaOverlay.value?.setPosition(pos)
})

dragBox.on('boxend', function () {
  clearDrawingLayer()

  isDrawing.value = true
  const map = mapRef.value?.map
  const extent = dragBox.getGeometry().getExtent()
  const proj = mapRef.value?.map.getView().getProjection()

  const bottomLeft = toLonLat([extent[0], extent[1]], proj)
  const topRight = toLonLat([extent[2], extent[3]], proj)
  const topLeft = toLonLat([extent[0], extent[3]], proj)
  const bottomRight = toLonLat([extent[2], extent[1]], proj)

  const poly: SrRegion = [
    { lat: topLeft[1], lon: topLeft[0] },
    { lat: bottomLeft[1], lon: bottomLeft[0] },
    { lat: bottomRight[1], lon: bottomRight[0] },
    { lat: topRight[1], lon: topRight[0] },
    { lat: topLeft[1], lon: topLeft[0] }
  ]
  helperStore.setPoly(poly)
  helperStore.setPolygonSource('box')
  helperStore.setConvexHull(convexHull(poly))
  const tag = helperStore.getFormattedAreaOfConvexHull()

  const vectorSource = getDrawingSource()
  if (!vectorSource) {
    logger.error('Drawing Layer source not found in boxend handler')
    if (map) map.addLayer(drawVectorLayer)
    return
  }

  const boxFeature = new Feature(polygonFromExtent(extent))
  boxFeature.setStyle(boxStyle)
  boxFeature.set('tag', tag)
  drawnPolygonFeature.value = null // Box doesn't support rasterize
  vectorSource.addFeature(boxFeature)
  const geometry = boxFeature.getGeometry()
  if (geometry) {
    helperStore.polyCoords = geometry.getCoordinates()
    if (map) {
      enableTagDisplay(map, vectorSource)
    }
  }

  disableDragBox()
  disableDrawPolygon()
  if (srDrawControlRef.value) {
    srDrawControlRef.value.resetPicked()
  }
  dragAreaOverlay.value?.setPosition(undefined)
  isDrawing.value = false
})

// --- Polygon drawing ---
function disableDrawPolygon() {
  if (mapRef.value?.map.getInteractions().getArray().includes(drawPolygon)) {
    mapRef.value?.map.removeInteraction(drawPolygon)
  }
}

function enableDrawPolygon() {
  disableDragBox()
  disableDrawPolygon()
  isDrawing.value = true
  mapRef.value?.map?.addInteraction(drawPolygon)
}

drawPolygon.on('drawstart', (evt) => {
  clearDrawingLayer()
  const map = mapRef.value?.map
  const feature = evt.feature
  dragAreaEl.textContent = ''
  dragAreaOverlay.value?.setPosition(undefined)

  polyGeomChangeKey = feature.getGeometry()?.on('change', () => {
    const geom = feature.getGeometry() as Polygon
    if (!map || !geom) return
    const m2 = Math.abs(geodesicArea(geom, { projection: map.getView().getProjection() }))
    dragAreaEl.textContent = formatArea(m2)
    const rings = geom.getCoordinates()
    const last = rings?.[0]?.[rings[0].length - 1]
    const pos = last ?? geom.getInteriorPoint().getCoordinates()
    dragAreaOverlay.value?.setPosition(pos as [number, number])
  })
})

drawPolygon.on('drawend', function (event) {
  const map = mapRef.value?.map
  const vectorSource = getDrawingSource()

  if (vectorSource) {
    const feature = event.feature
    feature.setStyle(rawPolyInactiveStyle)
    drawnPolygonFeature.value = feature

    const geometry = feature.getGeometry() as Polygon
    if (geometry && geometry.getType() === 'Polygon') {
      const rings = geometry.getCoordinates()
      const projName = computedProjName.value
      const mapViewProjection = mapRef.value?.map.getView().getProjection().getCode()
      const thisProj = getProjection(projName)

      let flatLonLatPairs
      if (thisProj?.getUnits() !== 'degrees') {
        const convertedRings: Coordinate[][] = rings.map((ring: Coordinate[]) =>
          ring.map((coord) => toLonLat(coord, mapViewProjection) as Coordinate)
        )
        helperStore.polyCoords = convertedRings
        flatLonLatPairs = convertedRings.flatMap((ring) => ring)
      } else {
        helperStore.polyCoords = rings
        flatLonLatPairs = rings.flatMap((ring) => ring)
      }

      const srLonLatCoordinates: SrRegion = flatLonLatPairs.map((coord) => ({
        lon: coord[0],
        lat: coord[1]
      }))

      if (isClockwise(srLonLatCoordinates)) {
        helperStore.setPoly(srLonLatCoordinates.reverse())
      } else {
        helperStore.setPoly(srLonLatCoordinates)
      }
      helperStore.setPolygonSource('polygon')

      // Calculate convex hull
      let thisConvexHull: SrRegion
      const isPolarProjection =
        projName === 'EPSG:5936' || projName === 'EPSG:3413' || projName === 'EPSG:3031'

      if (isPolarProjection) {
        const projectedCoords: Array<[number, number]> = rings
          .flatMap((ring) => ring)
          .map((coord) => [coord[0], coord[1]] as [number, number])
        const projectedHull = convexHullInProjection(projectedCoords)
        thisConvexHull = projectedHull.map((coord) => {
          const lonLat = toLonLat([coord[0], coord[1]], projName)
          return { lon: lonLat[0], lat: lonLat[1] }
        })
      } else {
        thisConvexHull = convexHull(srLonLatCoordinates)
      }

      helperStore.setConvexHull(thisConvexHull)
      const tag = helperStore.getFormattedAreaOfConvexHull()

      if (thisConvexHull) {
        const geoJson = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [thisConvexHull.map((coord) => [coord.lon, coord.lat])]
          },
          properties: { name: 'Convex Hull Polygon' }
        }

        // Draw hull directly (drawGeoJson uses mapStore.map which is null for helper map)
        const format = new GeoJSON()
        const currentProj = map?.getView().getProjection().getCode() || 'EPSG:3857'
        const hullFeatures = format.readFeatures(geoJson, {
          dataProjection: 'EPSG:4326',
          featureProjection: currentProj
        })
        hullFeatures.forEach((f, i) => {
          f.setId(`feature-userDrawn-${i}`)
          f.set('tag', tag)
          f.setStyle(hullActiveStyle)
        })
        vectorSource.addFeatures(hullFeatures)

        if (map) {
          enableTagDisplay(map, vectorSource)
        }

        // Zoom to hull extent
        const hullExtent = vectorSource.getExtent()
        if (map && hullExtent) {
          const [minX, minY, maxX, maxY] = hullExtent
          const isZeroArea = minX === maxX || minY === maxY
          if (!isZeroArea) {
            map.getView().fit(hullExtent, {
              size: map.getSize(),
              padding: [40, 40, 40, 40]
            })
          } else {
            zoomOutToFullMap(map)
          }
        }
      }
    }
    disableDrawPolygon()
    if (srDrawControlRef.value) {
      srDrawControlRef.value.resetPicked()
    }
  }

  if (polyGeomChangeKey) {
    unByKey(polyGeomChangeKey)
    polyGeomChangeKey = null
  }
  dragAreaOverlay.value?.setPosition(undefined)
  isDrawing.value = false
})

const clearDrawingLayer = () => {
  disableTagDisplay()
  const vectorSource = getDrawingSource()
  if (vectorSource) {
    const features = vectorSource.getFeatures()
    if (features.length > 0) {
      vectorSource.clear()
      helperStore.clearPolygon()
      drawnPolygonFeature.value = null
    }
  }
}

const handlePickedChanged = (newPickedValue: string) => {
  if (newPickedValue === 'Box') {
    toast.add({
      severity: 'info',
      summary: 'Draw instructions',
      detail: 'Draw a rectangle by clicking and dragging on the map',
      life: 5000
    })
    disableDragBox()
    disableDrawPolygon()
    enableDragBox()
  } else if (newPickedValue === 'Polygon') {
    disableDragBox()
    disableDrawPolygon()
    enableDrawPolygon()
    toast.add({
      severity: 'info',
      summary: 'Draw instructions',
      detail: 'Draw a polygon by clicking for each point and returning to the first point',
      life: 5000
    })
  } else if (newPickedValue === 'TrashCan') {
    disableDragBox()
    disableDrawPolygon()
    clearDrawingLayer()
  } else if (newPickedValue === '') {
    disableDragBox()
    disableDrawPolygon()
  }
}

// --- Map lifecycle ---
const handleDrawControlCreated = (drawControl: any) => {
  const map = mapRef.value?.map
  if (map) map.addControl(drawControl)
}

const handleViewControlCreated = (viewControl: any) => {
  const map = mapRef.value?.map
  if (map) map.addControl(viewControl)
}

const handleBaseLayerControlCreated = (baseLayerControl: any) => {
  const map = mapRef.value?.map
  if (map) map.addControl(baseLayerControl)
}

const handleGraticuleControlCreated = (graticuleControl: any) => {
  const map = mapRef.value?.map
  if (map) map.addControl(graticuleControl)
}

const handleUploadRegionControlCreated = (uploadControl: any) => {
  const map = mapRef.value?.map
  if (map) map.addControl(uploadControl)
}

const updateHelperMapView = async (reason: string, restoreView: boolean = false) => {
  logger.debug('updateHelperMapView started', { reason, restoreView })
  const map = mapRef.value?.map
  try {
    if (map) {
      const srViewObj = getHelperSrViewObj()
      if (!srViewObj) {
        logger.error('srViewObj is null in updateHelperMapView')
        return
      }
      const srViewKey = findSrViewKey(helperStore.selectedView, helperStore.selectedBaseLayer)
      if (srViewKey.value) {
        await updateMapView(map, srViewKey.value, reason, restoreView)
        map.addLayer(drawVectorLayer)
        addLayersForCurrentView(map, srViewObj.projectionName)
        removePolarOverlay(map)
        addPolarOverlay(map, srViewObj.projectionName)
      }
    }
  } catch (error) {
    logger.error('updateHelperMapView failed', {
      reason,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

const handleUpdateSrView = async () => {
  const map = mapRef.value?.map
  if (map) {
    saveMapZoomState(map)
    await updateHelperMapView('handleUpdateSrView', false)
  }
}

const handleUpdateBaseLayer = async () => {
  const map = mapRef.value?.map
  if (map) {
    const view = map.getView()
    const center = view.getCenter()
    const zoom = view.getZoom()
    if (center) mapStore.setCenterToRestore(center)
    if (zoom) mapStore.setZoomToRestore(zoom)
    mapStore.setExtentToRestore(view.calculateExtent(map.getSize()))
    saveMapZoomState(map)
    await updateHelperMapView('handleUpdateBaseLayer', true)
  }
}

onMounted(async () => {
  drawVectorLayer.set('name', 'Drawing Layer')
  drawVectorLayer.set('title', 'Drawing Layer')

  Object.values(srProjections.value).forEach((projection) => {
    proj4.defs(projection.name, projection.proj4def)
  })
  register(proj4 as any)
  drawVectorSource.clear()

  if (mapRef.value?.map) {
    helperStore.setMap(mapRef.value.map)
    const map = helperStore.getMap() as OLMap

    if (map) {
      const projectionNames = useProjectionNames()
      projectionNames.value.forEach((name) => {
        const wmsCap = useWmsCap(name)
        if (wmsCap) {
          mapStore.cacheWmsCapForProjection(name, wmsCap)
        }
      })

      dragAreaOverlay.value = new OlOverlay({
        element: dragAreaEl,
        offset: [8, -8],
        positioning: 'bottom-left',
        stopEvent: false
      })
      map.addOverlay(dragAreaOverlay.value as unknown as import('ol/Overlay').default)

      await updateHelperMapView('SrHelperMap onMounted', canRestoreZoomCenter(map))

      const graticule = mapStore.getOrCreateGraticule(map)
      map.addLayer(graticule)
    }
  }
})

onBeforeUnmount(() => {
  if (mapRef.value?.map) {
    saveMapZoomState(mapRef.value.map)
  }
})
</script>

<template>
  <div class="sr-helper-map-root">
    <div class="sr-helper-map-container">
      <Map.OlMap
        ref="mapRef"
        :loadTilesWhileAnimating="true"
        :loadTilesWhileInteracting="true"
        class="sr-ol-map"
      >
        <MapControls.OlLayerSwitcherControl
          :show_progress="true"
          :mouseover="false"
          :reordering="true"
          :trash="false"
          :extent="true"
        />
        <MapControls.OlZoomControl />
        <MapControls.OlMousePositionControl
          :projection="computedProjName"
          :coordinateFormat="stringifyFunc as any"
        />
        <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />
        <MapControls.OlScaleLineControl />

        <SrDrawControl
          ref="srDrawControlRef"
          @draw-control-created="handleDrawControlCreated"
          @picked-changed="handlePickedChanged"
        />
        <SrViewControl
          @view-control-created="handleViewControlCreated"
          @update-view="handleUpdateSrView"
        />
        <SrBaseLayerControl
          @baselayer-control-created="handleBaseLayerControlCreated"
          @update-baselayer="handleUpdateBaseLayer"
        />
        <SrGraticuleControl @graticule-control-created="handleGraticuleControlCreated" />
        <SrUploadRegionControl
          :reportUploadProgress="true"
          :loadReqPoly="false"
          corner="top-right"
          :offsetX="'0.5rem'"
          :offsetY="'3rem'"
          bg="rgba(255,255,255,0.6)"
          color="black"
          @upload-region-control-created="handleUploadRegionControlCreated"
        />
      </Map.OlMap>
      <SrMapDebugInfo v-if="debugStore.showDebugPanel" :map="mapRef?.map" />
    </div>
    <SrCustomTooltip ref="tooltipRef" id="HelperMapTooltip" />

    <!-- Copy polygon dialog -->
    <Dialog
      v-model:visible="showCopyDialog"
      header="Polygon Region"
      :modal="false"
      :draggable="true"
      :style="{ width: '28rem', maxWidth: '95vw' }"
      position="topleft"
      class="sr-copy-polygon-dialog"
    >
      <p class="sr-copy-dialog-hint">
        Copy this region and paste it into your AI agent prompt to complete an API request.
      </p>
      <div v-if="canRasterize" class="sr-copy-dialog-rasterize">
        <Checkbox v-model="rasterize" :binary="true" inputId="helperRasterize" />
        <label for="helperRasterize" class="sr-copy-dialog-rasterize-label"> Rasterize </label>
        <span class="sr-copy-dialog-rasterize-hint">
          {{
            rasterize ? 'Uses exact drawn polygon with region_mask' : 'Uses simplified convex hull'
          }}
        </span>
      </div>
      <pre class="sr-copy-dialog-pre">{{ clipboardText }}</pre>
      <template #footer>
        <Button
          :label="copied ? 'Copied!' : 'Copy to Clipboard'"
          :icon="copied ? 'pi pi-check' : 'pi pi-clipboard'"
          @click="copyToClipboard"
          :severity="copied ? 'success' : 'primary'"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* --- Copy dialog styling (matches app dark theme) --- */
:deep(.sr-copy-polygon-dialog.p-dialog) {
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

:deep(.sr-copy-polygon-dialog .p-dialog-header) {
  padding: 1rem 1.25rem;
  background-color: rgba(0, 0, 0, 0.4);
}

:deep(.sr-copy-polygon-dialog .p-dialog-title) {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
}

:deep(.sr-copy-polygon-dialog .p-dialog-content) {
  padding: 1.25rem;
}

:deep(.sr-copy-polygon-dialog .p-dialog-footer) {
  padding: 0.75rem 1.25rem;
  background-color: rgba(0, 0, 0, 0.2);
}

.sr-copy-dialog-hint {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #e0e0e0;
  line-height: 1.5;
}

.sr-copy-dialog-rasterize {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.sr-copy-dialog-rasterize-label {
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.sr-copy-dialog-rasterize-hint {
  color: #a0a0a0;
  font-size: 0.8rem;
  font-style: italic;
}

.sr-copy-dialog-pre {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--p-border-radius);
  padding: 0.75rem;
  font-size: 0.85rem;
  font-family: 'Courier New', Courier, monospace;
  color: #ffffff;
  max-height: 20rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

/* --- Map fills the full viewport --- */
.sr-helper-map-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.sr-helper-map-container) {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

:deep(.sr-ol-map) {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:deep(.ol-overlaycontainer-stopevent) {
  position: relative;
  display: flex !important;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-end;
  height: 100%;
  background-color: var(--white);
  border: 0;
}

:deep(.ol-control.ol-layerswitcher) {
  top: 5.5rem;
  bottom: auto;
  left: auto;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.ol-layerswitcher:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-attribution) {
  bottom: 0.5rem;
  top: auto;
  left: auto;
}

:deep(.ol-scale-line) {
  bottom: 0.25rem;
  left: 0.5rem;
}

:deep(.ol-control.ol-layerswitcher button) {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.ol-layerswitcher button:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-control.ol-layerswitcher > button::before) {
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.ol-layerswitcher > button::after) {
  border-radius: var(--p-border-radius);
}

:deep(.panel-container .ol-layerswitcher-buttons) {
  background-color: transparent;
}

:deep(.layerup.ol-noscroll) {
  border-radius: 3px;
  background-color: var(--p-primary-color);
}

:deep(.ol-control.ol-layerswitcher .panel-container) {
  background-color: var(--p-primary-100);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.sr-view-control) {
  top: 0.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  max-width: 30rem;
}

:deep(.ol-control.sr-baselayer-control) {
  top: 0.5rem;
  bottom: auto;
  right: auto;
  left: 11rem;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  max-width: 30rem;
}

:deep(.ol-control.sr-graticule-control) {
  top: auto;
  bottom: 2.5rem;
  right: auto;
  left: 0.5rem;
  border-radius: var(--p-border-radius);
}

:deep(.ol-zoom) {
  top: 6rem;
  left: 0.5rem;
  right: auto;
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  margin: auto;
  font-size: 1.25rem;
}

:deep(.sr-draw-control) {
  top: 12rem;
  left: 0.5rem;
  right: auto;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

:deep(.ol-touch .sr-draw-control),
:deep(.ol-touch .sr-upload-region-control) {
  font-size: 1.5em;
}

:deep(.ol-mouse-position) {
  bottom: 0.5rem;
  left: 50%;
  right: auto;
  top: auto;
  transform: translateX(-50%);
  color: black;
  background: color-mix(in srgb, var(--p-primary-color) 25%, transparent);
  border-radius: var(--p-border-radius);
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  width: fit-content;
  white-space: nowrap;
}

:deep(.ol-zoom .ol-zoom-in),
:deep(.ol-zoom .ol-zoom-out) {
  margin: 2px;
  border-radius: var(--p-border-radius);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: black;
  font-weight: 500;
}

:deep(.ol-zoom .ol-zoom-in):hover,
:deep(.ol-zoom .ol-zoom-out):hover {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-zoom .ol-zoom-in):active,
:deep(.ol-zoom .ol-zoom-out):active {
  background: color-mix(in srgb, var(--p-primary-color) 50%, transparent);
  transform: translateY(1px);
}

:deep(.ol-zoom .ol-zoom-out) {
  position: relative;
}

:deep(.ol-zoom .ol-zoom-out):before {
  content: '';
  position: absolute;
  top: 0px;
  left: 25%;
  right: 25%;
  border-top: 1px dashed black;
}

:deep(.ol-control.sr-upload-region-control) {
  position: absolute;
  top: var(--sr-top, auto);
  right: var(--sr-right, auto);
  bottom: var(--sr-bottom, auto);
  left: var(--sr-left, auto);
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  color: black;
  border-radius: var(--sr-radius, var(--p-border-radius));
  padding: 0.25rem;
}

:deep(.ol-control.sr-upload-region-control:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-measure-hud) {
  font: 700 0.9rem/1.4 var(--p-font-family, system-ui, sans-serif);
  padding: 0.35rem 0.6rem;
  background: rgba(0, 0, 0, 0.85);
  color: #ffeb3b;
  border: 2px solid #fff;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  opacity: 1;
}

:deep(.ol-layer canvas) {
  overflow: visible !important;
}

:deep(.ol-control.ol-layerswitcher > button) {
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: transparent;
  display: grid;
  place-items: center;
  line-height: 1;
  font-size: 1.4rem;
}

:deep(.ol-control.ol-layerswitcher > button::before),
:deep(.ol-control.ol-layerswitcher > button::after) {
  margin: 0;
  line-height: 1;
}

:deep(.ol-control.ol-layerswitcher .panel-container) {
  width: 22rem;
  max-width: 90vw;
}

:deep(.ol-control.ol-layerswitcher .panel) {
  max-height: 55vh;
  overflow: auto;
}

:deep(.ol-layerswitcher .panel .li-content) {
  padding: 0.25rem 0.5rem;
}

:deep(.ol-layerswitcher .panel .li-content > label) {
  font-size: 0.95rem;
}

:deep(.ol-layerswitcher .panel .li-content > label::before) {
  width: 0.95rem;
  height: 0.95rem;
}

:deep(.ol-layerswitcher label) {
  background-color: transparent;
  color: var(--p-primary-color);
  font-weight: bold;
  font-family: var(--p-font-family);
  border-radius: var(--p-border-radius);
}

:deep(.ol-layerswitcher .panel .li-content > label::before) {
  border-radius: 2px;
  border-color: var(--p-primary-color);
  border-width: 2px;
}

:deep(.panel-container.ol-ext-dialog) {
  background-color: transparent;
}

:deep(.ol-ext-dialog .ol-closebox.ol-title) {
  color: var(--p-text-color);
  background-color: var(--p-primary-300);
  font-family: var(--p-font-family);
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.ol-wmscapabilities) {
  top: 0.5rem;
  bottom: auto;
  left: auto;
  right: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  padding: 0.25rem;
}

:deep(.ol-control.ol-wmscapabilities:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-control.ol-wmscapabilities > button) {
  color: black;
  font-weight: 500;
  font-size: 1.1rem;
  background: transparent;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  display: grid;
  place-items: center;
}
</style>
