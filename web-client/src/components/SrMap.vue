<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import type OLMap from 'ol/Map.js'
import { useToast } from 'primevue/usetoast'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrMap')

import { findSrViewKey } from '@/composables/SrViews'
import { useProjectionNames } from '@/composables/SrProjections'
import { srProjections } from '@/composables/SrProjections'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4.js'
import 'ol-geocoder/dist/ol-geocoder.min.css'
import { useMapStore } from '@/stores/mapStore'
import { useGeoCoderStore } from '@/stores/geoCoderStore'
import { get as getProjection } from 'ol/proj.js'
import { addLayersForCurrentView } from '@/composables/SrLayers'
import { isCoordinateInProjectionExtent } from '@/utils/SrCrsTransform'
import { Layer } from 'ol/layer.js'
import { useWmsCap } from '@/composables/useWmsCap'
import Feature from 'ol/Feature.js'
import type { FeatureLike } from 'ol/Feature.js'
import type Geometry from 'ol/geom/Geometry.js'
import DragBox from 'ol/interaction/DragBox.js'
import Draw from 'ol/interaction/Draw.js'
import VectorSource from 'ol/source/Vector.js'
import { Stroke, Style, Fill } from 'ol/style.js'
import {
  clearPolyCoords,
  clearReqGeoJsonData,
  drawGeoJson,
  enableTagDisplay,
  disableTagDisplay,
  saveMapZoomState,
  renderRequestPolygon,
  canRestoreZoomCenter,
  assignStyleFunctionToPinLayer
} from '@/utils/SrMapUtils'
import { onActivated } from 'vue'
import { onDeactivated } from 'vue'
import type { Ref } from 'vue'
import { checkAreaOfConvexHullWarning, updateSrViewName, renderReqPin } from '@/utils/SrMapUtils'
import { toLonLat } from 'ol/proj.js'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { convexHull, isClockwise, convexHullInProjection } from '@/composables/SrTurfUtils'
import { type Coordinate } from 'ol/coordinate.js'
import { hullColor, type SrRegion } from '@/types/SrTypes'
import { format } from 'ol/coordinate.js'
import SrViewControl from './SrViewControl.vue'
import SrBaseLayerControl from './SrBaseLayerControl.vue'
import SrGraticuleControl from './SrGraticuleControl.vue'
import SrDrawControl from '@/components/SrDrawControl.vue'
import { usePolarOverlay } from '@/composables/usePolarOverlay'
import SrRasterizeControl from '@/components/SrRasterizeControl.vue'
import { Map, MapControls } from 'vue3-openlayers'
import { useRequestsStore } from '@/stores/requestsStore'
import VectorLayer from 'ol/layer/Vector.js'
import { useDebugStore } from '@/stores/debugStore'
import { updateMapView } from '@/utils/SrMapUtils'
import {
  renderSvrReqPoly,
  renderSvrReqRegionMask,
  zoomOutToFullMap,
  renderSvrReqPin
} from '@/utils/SrMapUtils'
import router from '@/router/index.js'
import { useRecTreeStore } from '@/stores/recTreeStore'
import SrFeatureMenuOverlay from '@/components/SrFeatureMenuOverlay.vue'
import type { Source } from 'ol/source.js'
import type LayerRenderer from 'ol/renderer/Layer.js'
import SrCustomTooltip from '@/components//SrCustomTooltip.vue'
import SrDropPinControl from '@/components//SrDropPinControl.vue'
import SrUploadRegionControl from '@/components/SrUploadRegionControl.vue'
import SrExportPolygonControl from '@/components/SrExportPolygonControl.vue'
import SrMapDebugInfo from '@/components/SrMapDebugInfo.vue'
import Point from 'ol/geom/Point.js'
import { readShapefileToOlFeatures } from '@/composables/useReadShapefiles'
import { useGeoJsonStore } from '@/stores/geoJsonStore'
import OlOverlay from 'ol/Overlay.js'
import type Overlay from 'ol/Overlay'
import { getArea as geodesicArea } from 'ol/sphere.js'
import Polygon, { fromExtent as polygonFromExtent } from 'ol/geom/Polygon.js'
import { unByKey } from 'ol/Observable.js'

import type { SelectPayload, MiniFeature } from '@/components/SrFeatureTreeNode.vue'
import OLFeature from 'ol/Feature.js'

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

const defaultBathymetryFeatures: Ref<Feature<Geometry>[] | null> = ref(null)
const showBathymetryFeatures = computed(() => {
  return (
    reqParamsStore.missionValue === 'ICESat-2' && reqParamsStore.iceSat2SelectedAPI === 'atl24x'
  )
})
const defaultBathymetryFeaturesLoaded = ref(false)
const featureMenuOverlayRef = ref()
const tooltipRef = ref()

const wasRecordsLayerVisible = ref(false)
const isDrawing = ref(false)
const drawnPolygonFeature = ref<Feature<Geometry> | null>(null)

function unwrapClusterToArray(item: MiniFeature): FeatureLike[] {
  const inner = item.get?.('features')
  return Array.isArray(inner) && inner.length
    ? (inner as FeatureLike[])
    : [item as unknown as FeatureLike]
}
function toVectorFeatures(arr: FeatureLike[]): Feature<Geometry>[] {
  return arr.filter((f): f is Feature<Geometry> => f instanceof OLFeature)
}

async function onFeatureMenuSelect(payload: SelectPayload) {
  if (payload.kind === 'record') {
    // Do what your Analysis menu does: e.g. navigate/select/zoom
    await router.push(`/analyze/${payload.reqId}`)
    featureMenuOverlayRef.value?.hideMenu()
    return
  }

  // kind === 'feature'
  const likes = unwrapClusterToArray(payload.feature)
  const vectors = toVectorFeatures(likes)
  if (vectors.length) await onFeatureClick(vectors) // your existing handler
  featureMenuOverlayRef.value?.hideMenu()
}

const reqParamsStore = useReqParamsStore()
const debugStore = useDebugStore()
const recTreeStore = useRecTreeStore()

interface SrDrawControlMethods {
  resetPicked: () => void
}
const geoCoderStore = useGeoCoderStore()
const lonlat_template = 'Latitude:{y}\u00B0, Longitude:{x}\u00B0'
const meters_template = 'y:{y}m, x:{x}m'
const stringifyFunc = (coordinate: Coordinate) => {
  const projName = useMapStore().getSrViewObj().projectionName
  let newProj = getProjection(projName)
  let newCoord = coordinate
  if (!debugStore.useMetersForMousePosition) {
    if (newProj?.getUnits() !== 'degrees') {
      newCoord = toLonLat(coordinate, projName)
      //const polarStereographic = "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";
      //const customProjectedCoordinates = proj4(polarStereographic, "EPSG:4326", coordinate);
      //const customProjectedCoordinates = transform(coordinate, projName, 'EPSG:4326');
      //console.log(`customProjectedCoordinates:\n${customProjectedCoordinates}, newCoord:\n${newCoord}`);
    }
    return format(newCoord, lonlat_template, 4)
  } else {
    return format(coordinate, meters_template, 4)
  }
}
const srDrawControlRef = ref<SrDrawControlMethods | null>(null)
const mapRef = ref<{ map: OLMap }>()
const mapStore = useMapStore()
const toast = useToast()

// Initialize polar overlay composable - always visible
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

const pinVectorSource = new VectorSource({ wrapX: false })
const pinVectorLayer = new VectorLayer({
  source: pinVectorSource,
  zIndex: 100
})

const recordsVectorSource = new VectorSource({ wrapX: false })
const recordsLayer = new VectorLayer({
  source: recordsVectorSource,
  zIndex: 50
})

const uploadedFeaturesVectorSource = new VectorSource({ wrapX: false })
const uploadedFeaturesVectorLayer = new VectorLayer({
  source: uploadedFeaturesVectorSource,
  zIndex: 10
})

const bathymetryFeaturesVectorSource = new VectorSource({ wrapX: false })
const bathymetryFeaturesVectorLayer = new VectorLayer({
  source: bathymetryFeaturesVectorSource,
  zIndex: 10
})

// Set a custom property, like 'name'
const drawPolygon = new Draw({
  source: drawVectorSource,
  type: 'Polygon',
  style: new Style({
    stroke: new Stroke({
      color: 'blue',
      width: 2
    }),
    fill: new Fill({
      color: 'rgba(255, 0, 0, 0.1)'
    })
  })
})

const handleEvent = (event: any) => {
  logger.debug('Map event received', { event })
}
const computedProjName = computed(() => mapStore.getSrViewObj().projectionName)

function getLayerByName(name: string): Layer<Source, LayerRenderer<any>> | undefined {
  const baseLayer = mapRef.value?.map
    .getLayers()
    .getArray()
    .find((layer) => layer.get('name') === name)
  return baseLayer as Layer<Source, LayerRenderer<any>> | undefined
}

// Function to toggle the DragBox interaction.
function disableDragBox() {
  //console.log("SrMap disableDragBox");
  // Check if the DragBox interaction is added to the map.
  //console.log("mapRef.value?.map.getInteractions():",mapRef.value?.map.getInteractions());
  mapRef.value?.map.removeInteraction(dragBox)
}

function enableDragBox() {
  //console.log("SrMap enableDragBox");
  disableDragBox() // reset then add
  disableDrawPolygon()
  mapRef.value?.map.addInteraction(dragBox)
  isDrawing.value = true
  const map = mapRef.value?.map
  const records = getLayerByName('Records Layer')

  if (map && records) {
    wasRecordsLayerVisible.value = records.getVisible()
    records.setVisible(false) // Hide the records layer while drawing
  }
}

var boxStyle = new Style({
  stroke: new Stroke({
    color: 'red', // Red stroke color
    width: 2 // Stroke width
  }),
  fill: new Fill({
    color: 'rgba(255, 0, 0, 0.1)' // Red fill with 10% opacity
  })
})

var polygonStyle = new Style({
  stroke: new Stroke({
    color: 'Red', // Red stroke color
    width: 2 // Stroke width
  })
})

dragBox.on('boxstart', () => {
  // show empty HUD near the starting corner
  const geom = dragBox.getGeometry()
  if (!geom) return
  const extent = geom.getExtent()
  // position at the current top-right corner
  const pos: [number, number] = [extent[2], extent[3]]
  dragAreaEl.textContent = ''
  dragAreaOverlay.value?.setPosition(pos)
})

dragBox.on('boxdrag', () => {
  const map = mapRef.value?.map
  const geom = dragBox.getGeometry()
  if (!map || !geom) return

  // 1) Current extent
  const extent = geom.getExtent()

  // 2) Build a polygon from the extent in the *map’s projection*
  //const poly = Polygon.fromExtent(extent);
  const poly = polygonFromExtent(extent)

  // 3) Geodesic area (meters²), sphere-corrected using the map projection
  const m2 = geodesicArea(poly, { projection: map.getView().getProjection() })
  dragAreaEl.textContent = formatArea(Math.abs(m2))

  // 4) Move HUD to the box’s top-right corner so it stays out of the box
  const pos: [number, number] = [extent[2], extent[3]]
  dragAreaOverlay.value?.setPosition(pos)
})

// your existing code…
// …
// hide the HUD now that the final tag is drawn via your existing path

dragBox.on('boxend', function () {
  //console.log("dragBox.on boxend");
  // Clear any existing drawing before starting new one
  clearDrawingLayer()
  clearPolyCoords()

  isDrawing.value = true
  const map = mapRef.value?.map
  const records = getLayerByName('Records Layer')

  if (map && records) {
    wasRecordsLayerVisible.value = records.getVisible()
    records.setVisible(true) // Hide the records layer while drawing
  }
  const extent = dragBox.getGeometry().getExtent()
  //console.log("Box extent in map coordinates:", extent);

  // Transform extent to geographic coordinates (longitude and latitude)
  const bottomLeft = toLonLat([extent[0], extent[1]], mapRef.value?.map.getView().getProjection())
  const topRight = toLonLat([extent[2], extent[3]], mapRef.value?.map.getView().getProjection())

  // Calculate topLeft and bottomRight in geographic coordinates
  const topLeft = toLonLat([extent[0], extent[3]], mapRef.value?.map.getView().getProjection())
  const bottomRight = toLonLat([extent[2], extent[1]], mapRef.value?.map.getView().getProjection())

  //console.log(`Bottom-left corner in lon/lat: ${bottomLeft}`);
  //console.log(`Top-left corner in lon/lat: ${topLeft}`);
  //console.log(`Top-right corner in lon/lat: ${topRight}`);
  //console.log(`Bottom-right corner in lon/lat: ${bottomRight}`);

  // Create a region array of coordinates
  const poly = [
    { lat: topLeft[1], lon: topLeft[0] },
    { lat: bottomLeft[1], lon: bottomLeft[0] },
    { lat: bottomRight[1], lon: bottomRight[0] },
    { lat: topRight[1], lon: topRight[0] },
    { lat: topLeft[1], lon: topLeft[0] } // close the loop by repeating the first point
  ]
  reqParamsStore.setPoly(poly)
  reqParamsStore.setPolygonSource('box')
  drawnPolygonFeature.value = null // Clear polygon reference for box (no rasterize for box)
  //console.log("Poly:", poly);
  reqParamsStore.setConvexHull(convexHull(poly))
  const tag = reqParamsStore.getFormattedAreaOfConvexHull()
  //console.log('reqParamsStore.poly:',reqParamsStore.convexHull);

  const vectorLayer = mapRef.value?.map
    .getLayers()
    .getArray()
    .find((layer) => layer.get('name') === 'Drawing Layer')
  if (vectorLayer === undefined || vectorLayer === null) {
    logger.error('Drawing Layer is undefined in dragBox boxend handler')
    mapRef.value?.map.addLayer(drawVectorLayer)
  }
  if (!(vectorLayer instanceof Layer)) {
    logger.error('Invalid Drawing Layer type in dragBox boxend handler')
    return
  }
  const vectorSource = vectorLayer?.getSource()
  if (vectorSource) {
    // Create a rectangle feature using the extent
    //let boxFeature = new Feature(fromExtent(extent));
    let boxFeature = new Feature(polygonFromExtent(extent))
    // Apply the style to the feature
    boxFeature.setStyle(boxStyle)
    //console.log("dragBox.on boxend boxFeature tag:",tag);
    boxFeature.set('tag', tag)
    // Add the feature to the vector layer
    vectorSource.addFeature(boxFeature)
    //console.log("boxFeature:",boxFeature);
    // Get the geometry of the feature
    const geometry = boxFeature.getGeometry()
    //console.log("geometry:",geometry);
    if (geometry) {
      //console.log("geometry.getType():",geometry.getType());
      // Get the coordinates of the polygon shaped as a rectangle
      mapStore.polyCoords = geometry.getCoordinates()
      if (mapRef.value?.map) {
        enableTagDisplay(mapRef.value?.map, vectorSource)
      } else {
        logger.error('Map is null in dragBox boxend handler')
      }
      //console.log(`polyCoords:${mapStore.polyCoords}`);
      checkAreaOfConvexHullWarning()
    } else {
      logger.error('Geometry is null in dragBox boxend handler')
    }
  } else {
    logger.error('VectorSource is null in dragBox boxend handler')
  }
  disableDragBox()
  disableDrawPolygon()
  if (srDrawControlRef.value) {
    srDrawControlRef.value.resetPicked()
  }
  dragAreaOverlay.value?.setPosition(undefined)
})

// Function to toggle the Draw interaction.
function disableDrawPolygon() {
  //console.log("disableDrawPolygon");
  // Check if the Draw interaction is added to the map.
  if (mapRef.value?.map.getInteractions().getArray().includes(drawPolygon)) {
    // If it is, remove it.
    mapRef.value?.map.removeInteraction(drawPolygon)
  }
}

function enableDrawPolygon() {
  disableDragBox()
  disableDrawPolygon() // reset then add
  isDrawing.value = true
  const map = mapRef.value?.map
  const records = getLayerByName('Records Layer')

  if (map && records) {
    wasRecordsLayerVisible.value = records.getVisible()
    records.setVisible(false) // Hide the records layer while drawing
  }
  map?.addInteraction(drawPolygon)
  //console.log("enableDrawPolygon");
}
// Show live area while drawing a polygon
drawPolygon.on('drawstart', (evt) => {
  // Clear any existing drawing before starting new one
  clearDrawingLayer()
  clearPolyCoords()

  const map = mapRef.value?.map
  const feature = evt.feature

  // clear + show HUD
  dragAreaEl.textContent = ''
  dragAreaOverlay.value?.setPosition(undefined)

  polyGeomChangeKey = feature.getGeometry()?.on('change', () => {
    const geom = feature.getGeometry() as Polygon
    if (!map || !geom) return

    // geodesic area in m² using current view projection
    const m2 = Math.abs(geodesicArea(geom, { projection: map.getView().getProjection() }))
    dragAreaEl.textContent = formatArea(m2)

    // position HUD near the latest vertex (fallback: interior of polygon)
    const rings = geom.getCoordinates()
    const last = rings?.[0]?.[rings[0].length - 1]
    const pos = last ?? geom.getInteriorPoint().getCoordinates()
    dragAreaOverlay.value?.setPosition(pos as [number, number])
  })
})

drawPolygon.on('drawend', function (event) {
  //console.log("drawend:", event);
  const map = mapRef.value?.map

  const vectorLayer = map
    ?.getLayers()
    .getArray()
    .find((layer) => layer.get('name') === 'Drawing Layer')

  if (vectorLayer && vectorLayer instanceof Layer) {
    const vectorSource = vectorLayer.getSource()
    if (vectorSource) {
      // Access the feature that was drawn
      const feature = event.feature
      feature.setStyle(polygonStyle)
      drawnPolygonFeature.value = feature // Store reference for rasterize styling
      //console.log("feature:", feature);
      // Get the geometry of the feature
      const geometry = feature.getGeometry() as Polygon
      //console.log("geometry:", geometry);
      // Check if the geometry is a polygon
      if (geometry && geometry.getType() === 'Polygon') {
        //console.log("geometry:",geometry);
        // Get the coordinates of all the rings of the polygon
        const rings = geometry.getCoordinates() // This retrieves all rings
        //console.log("Original polyCoords:", rings);

        const projName = useMapStore().getSrViewObj().projectionName
        const mapViewProjection = mapRef.value?.map.getView().getProjection().getCode()
        let thisProj = getProjection(projName)

        let flatLonLatPairs
        if (thisProj?.getUnits() !== 'degrees') {
          //Convert each ring's coordinates to lon/lat using toLonLat with EXPLICIT projection
          const convertedRings: Coordinate[][] = rings.map((ring: Coordinate[]) =>
            ring.map((coord) => toLonLat(coord, mapViewProjection) as Coordinate)
          )

          //console.log("Converted polyCoords:", convertedRings);
          mapStore.polyCoords = convertedRings
          flatLonLatPairs = convertedRings.flatMap((ring) => ring)
        } else {
          mapStore.polyCoords = rings
          flatLonLatPairs = rings.flatMap((ring) => ring)
        }
        const srLonLatCoordinates: SrRegion = flatLonLatPairs.map((coord) => ({
          lon: coord[0],
          lat: coord[1]
        }))

        if (isClockwise(srLonLatCoordinates)) {
          //console.log('poly is clockwise, reversing');
          reqParamsStore.setPoly(srLonLatCoordinates.reverse())
        } else {
          ////console.log('poly is counter-clockwise');
          reqParamsStore.setPoly(srLonLatCoordinates)
        }
        reqParamsStore.setPolygonSource('polygon')
        //console.log('reqParamsStore.poly:',reqParamsStore.poly);

        //console.log('srLonLatCoordinates:',srLonLatCoordinates);
        // Calculate convex hull (used when rasterize is NOT enabled)
        // For polar projections, calculate hull in projection space, then convert to lon/lat
        let thisConvexHull: SrRegion
        const isPolarProjection =
          projName === 'EPSG:5936' || projName === 'EPSG:3413' || projName === 'EPSG:3031'

        if (isPolarProjection) {
          // Calculate convex hull in projection space (meters)
          const projectedCoords: Array<[number, number]> = rings
            .flatMap((ring) => ring)
            .map((coord) => [coord[0], coord[1]] as [number, number])
          const projectedHull = convexHullInProjection(projectedCoords)

          // Convert hull back to lon/lat for storage
          thisConvexHull = projectedHull.map((coord) => {
            const lonLat = toLonLat([coord[0], coord[1]], projName)
            return { lon: lonLat[0], lat: lonLat[1] }
          })
        } else {
          // For other projections, use the original lon/lat method
          thisConvexHull = convexHull(srLonLatCoordinates)
        }
        reqParamsStore.setConvexHull(thisConvexHull) // this also populates the area
        //console.log('reqParamsStore.poly:',reqParamsStore.convexHull);
        // Create GeoJSON from reqParamsStore.convexHull for display
        const tag = reqParamsStore.getFormattedAreaOfConvexHull()
        if (thisConvexHull) {
          const geoJson = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [thisConvexHull.map((coord) => [coord.lon, coord.lat])]
            },
            properties: {
              name: 'Convex Hull Polygon'
            }
          }
          if (map) {
            enableTagDisplay(map, vectorSource)
          } else {
            logger.error('Map is null when enabling tag display')
          }
          //console.log('GeoJSON:', JSON.stringify(geoJson));
          const drawExtent = drawGeoJson(
            'userDrawn',
            vectorSource,
            JSON.stringify(geoJson),
            hullColor,
            false,
            tag
          )
          if (map && drawExtent) {
            const [minX, minY, maxX, maxY] = drawExtent
            const isZeroArea = minX === maxX || minY === maxY

            if (!isZeroArea) {
              map.getView().fit(drawExtent, {
                size: map.getSize(),
                padding: [40, 40, 40, 40]
              })
            } else {
              logger.warn('Zero-area extent, skipping zoom', { drawExtent })
              zoomOutToFullMap(map)
            }
          }
          //console.log("drawExtent:",drawExtent);
          //console.log("drawExtent in lon/lat:",drawExtent.map(coord => toLonLat(coord)));
          //console.log("drawExtent in projName:",drawExtent.map(coord => toLonLat(coord,projName)));
          //console.log("drawExtent in projName:",drawExtent.map(coord => toLonLat(coord,projName)));
          //console.log("reqParamsStore.poly:",reqParamsStore.poly);
          // Note: reqParamsStore.poly keeps the RAW polygon (not convex hull)
          // The convex hull is stored in reqParamsStore.convexHull
          // Request building logic will decide which to use based on rasterize state
          checkAreaOfConvexHullWarning()
        } else {
          logger.error('ConvexHull is null after polygon draw')
        }
      } else {
        logger.error('Invalid geometry, not a polygon', { geometryType: geometry?.getType() })
      }
      disableDrawPolygon()
      if (srDrawControlRef.value) {
        srDrawControlRef.value.resetPicked()
      }
    } else {
      logger.error('VectorSource is null in drawend handler')
    }
  } else {
    logger.error('VectorLayer is null in drawend handler')
  }

  // stop listening + hide HUD (your existing tagging UI will take over)
  if (polyGeomChangeKey) {
    unByKey(polyGeomChangeKey)
    polyGeomChangeKey = null
  }
  dragAreaOverlay.value?.setPosition(undefined)

  isDrawing.value = false
  const records = getLayerByName('Records Layer')
  if (map && records && wasRecordsLayerVisible.value) {
    records.setVisible(true)
  }
})

const clearDrawingLayer = () => {
  //console.log("Clearing Drawing Layer");
  disableTagDisplay()
  let cleared = false
  const vectorLayer = mapRef.value?.map
    .getLayers()
    .getArray()
    .find((layer) => layer.get('name') === 'Drawing Layer')
  if (vectorLayer && vectorLayer instanceof Layer) {
    const vectorSource = vectorLayer.getSource()
    if (vectorSource) {
      const features = vectorSource.getFeatures()
      //console.log("VectorSource hasFeature:",features.length);
      if (features.length > 0) {
        //console.log("Clearing VectorSource features");
        vectorSource.clear()
        cleared = true
        reqParamsStore.poly = []
        reqParamsStore.setConvexHull([])
        drawnPolygonFeature.value = null // Clear the polygon reference
      } else {
        //console.log("clearDrawingLayer vectorSource has no features:",vectorSource);
      }
    } else {
      logger.error('VectorSource is null in clearDrawingLayer')
    }
  } else {
    logger.debug('VectorLayer is null in clearDrawingLayer')
  }
  return cleared
}

const handlePickedChanged = async (newPickedValue: string) => {
  //console.log(`handlePickedChanged: ${newPickedValue}`);

  if (newPickedValue === 'Box') {
    if ((await useRequestsStore().getNumReqs()) < useRequestsStore().helpfulReqAdviceCnt + 2) {
      toast.add({
        severity: 'info',
        summary: 'Draw instructions',
        detail: 'Draw a rectangle by clicking and dragging on the map',
        life: 5000
      })
    }
    disableDragBox()
    disableDrawPolygon()
    // Don't clear existing polygons - let user draw new box which will replace it
    enableDragBox()
  } else if (newPickedValue === 'Polygon') {
    disableDragBox()
    disableDrawPolygon()
    // Don't clear existing polygons - let user draw new polygon which will replace it
    enableDrawPolygon()
    if ((await useRequestsStore().getNumReqs()) < useRequestsStore().helpfulReqAdviceCnt + 2) {
      toast.add({
        severity: 'info',
        summary: 'Draw instructions',
        detail: 'Draw a polygon by clicking for each point and returning to the first point',
        life: 5000
      })
    }
  } else if (newPickedValue === 'TrashCan') {
    disableDragBox()
    disableDrawPolygon()
    clearDrawingLayer()
    clearPolyCoords()
    clearReqGeoJsonData()
    const records = getLayerByName('Records Layer')
    const map = mapRef.value?.map
    if (map && records && wasRecordsLayerVisible.value) {
      records.setVisible(true)
    }
    //console.log("TrashCan selected Clearing Drawing Layer, disabling draw");
  } else if (newPickedValue === '') {
    // Reset Picked called and cleared highlight
    disableDragBox()
    disableDrawPolygon()
    const records = getLayerByName('Records Layer')
    const map = mapRef.value?.map
    if (map && records && wasRecordsLayerVisible.value) {
      records.setVisible(true)
    }
  } else {
    logger.error('Unsupported draw type', { drawType: newPickedValue })
    toast.add({ severity: 'error', summary: 'Unsupported draw type error', detail: 'Error' })
  }
}

// Define a function to handle the addresschosen event
function onAddressChosen(evt: any) {
  //console.log('onAddressChosen:',evt);
  // Zoom to the selected location
  const map = mapStore.getMap()
  if (map) {
    const view = map.getView()
    if (view) {
      view.animate({
        center: evt.coordinate,
        duration: 1000,
        zoom: 10
      })
    } else {
      logger.error('View is not defined in onAddressChosen')
    }
  } else {
    logger.error('Map is not defined in onAddressChosen')
  }
}

async function onFeatureClick(features: Feature<Geometry>[]) {
  //console.log('onFeatureClick:', features, coordinate);
  if (features && features.length > 0) {
    const feature = features[0]
    const properties = feature.getProperties()
    //console.log('Feature properties:', properties);
    if (properties.req_id) {
      await router.push(`/analyze/${properties.req_id.toString()}`)
    }
  } else {
    logger.error('No features found on click')
  }
}

function loadBathymetryFeatures(features: Feature<Geometry>[]) {
  //console.log('loadBathymetryFeatures.length:', features.length);
  const map = mapStore.getMap()
  if (map) {
    if (bathymetryFeaturesVectorLayer && bathymetryFeaturesVectorLayer instanceof Layer) {
      const vectorSource = bathymetryFeaturesVectorLayer.getSource()
      if (vectorSource) {
        logger.debug('Adding bathymetry features to vector source', {
          featureCount: features.length
        })
        vectorSource.addFeatures(features)
        logger.debug('Bathymetry features added to vector source')
      }
    } else {
      logger.error('Bathymetry vector layer not found or invalid type')
      console.trace('Vector layer not found or is not a VectorLayer')
      // Handle the case where the vector layer is not found or is not a VectorLayer
    }
  } else {
    logger.error('Map is not defined in loadBathymetryFeatures')
    // Handle the case where the map is not defined
  }
  defaultBathymetryFeaturesLoaded.value = true
  //console.log("loadBathymetryFeatures defaultBathymetryFeaturesLoaded:",defaultBathymetryFeaturesLoaded.value);
}

async function loadDefaultBathymetryFeatures() {
  const bathyFiles = {
    shp: '/shapefiles/ATL24_Mask_v5.shp',
    dbf: '/shapefiles/ATL24_Mask_v5.dbf',
    shx: '/shapefiles/ATL24_Mask_v5.shx'
  }

  const { features, warning } = await readShapefileToOlFeatures(bathyFiles)
  defaultBathymetryFeatures.value = features
  if (warning) {
    toast.add({
      severity: 'warn',
      summary: 'Projection Warning',
      detail: warning,
      life: 8000
    })
  }
  if (defaultBathymetryFeatures.value?.length) {
    loadBathymetryFeatures(defaultBathymetryFeatures.value)
  } else {
    logger.warn('No bathymetry features loaded from static shapefile')
  }
}

onMounted(async () => {
  //console.log("SrMap onMounted");
  //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
  if (tooltipRef.value) {
    mapStore.tooltipRef = tooltipRef.value
  } else {
    logger.error('tooltipRef is null on mount')
  }
  // Wait for the control to be rendered in the DOM
  const button = document.querySelector<HTMLButtonElement>('.ol-control.ol-layerswitcher > button')
  if (button) {
    button.title = 'Toggle layer switcher' // Your tooltip text here
  }
  drawVectorLayer.set('name', 'Drawing Layer')
  drawVectorLayer.set('title', 'Drawing Layer')
  pinVectorLayer.set('name', 'Pin Layer')
  pinVectorLayer.set('title', 'Pin Layer')
  recordsLayer.set('name', 'Records Layer')
  recordsLayer.set('title', 'Records Layer')
  uploadedFeaturesVectorLayer.set('name', 'Uploaded Features')
  uploadedFeaturesVectorLayer.set('title', 'Uploaded Features')
  bathymetryFeaturesVectorLayer.set('name', 'Bathymetry Features')
  bathymetryFeaturesVectorLayer.set('title', 'Bathymetry Features')
  Object.values(srProjections.value).forEach((projection) => {
    //console.log(`Title: ${projection.title}, Name: ${projection.name} def:${projection.proj4def}`);
    proj4.defs(projection.name, projection.proj4def)
  })
  //console.log("SrMap onMounted registering proj4:",proj4);
  register(proj4 as any)

  // Clear the global drawVectorSource when component mounts to prevent stale features
  // from previous navigation sessions from appearing with incorrect coordinates
  drawVectorSource.clear()

  if (mapRef.value?.map) {
    //console.log("SrMap onMounted map:",mapRef.value.map);
    mapStore.setMap(mapRef.value.map)
    const map = mapStore.getMap() as OLMap
    const haveReqPoly = !(
      reqParamsStore.poly === undefined ||
      reqParamsStore.poly === null ||
      reqParamsStore.poly.length === 0
    )
    const haveReqPin = reqParamsStore.atl13.coord != null
    if (map) {
      if (!geoCoderStore.isInitialized()) {
        //console.log("Initializing geocoder");
        geoCoderStore.initGeoCoder({
          provider: 'photon',
          lang: 'en',
          placeholder: 'Search for ...',
          targetType: 'glass-button',
          limit: 5,
          keepOpen: false
        })
      }
      const geocoder = geoCoderStore.getGeoCoder()
      if (geocoder) {
        //console.log("SrMap onMounted adding geocoder");
        map.addControl(geocoder)
        geocoder.on('addresschosen', onAddressChosen)

        // Add tooltip to geocoder button
        const geocoderButton = document.querySelector<HTMLButtonElement>('.gcd-gl-btn')
        if (geocoderButton) {
          geocoderButton.title = 'Search for a location'
        }
      } else {
        logger.error('Geocoder is null on mount')
      }
      const projectionNames = useProjectionNames()
      projectionNames.value.forEach((name) => {
        const wmsCap = useWmsCap(name)
        if (wmsCap) {
          mapStore.cacheWmsCapForProjection(name, wmsCap)
        } else {
          logger.error('No WMS capabilities for projection', { projection: name })
        }
        //
        // TBD WMTS element is same as WMS element, can't add both?
        //
        // const wmtsCap = useWmtsCap(name);
        // if(wmtsCap){
        //   mapStore.cacheWmtsCapForProjection(name, wmtsCap);
        // } else {
        //   console.error(`Error: no wmtsCap for projection: ${name}`);
        // }
      })
      mapStore.setCurrentWmsCap(mapStore.getSrViewObj().projectionName)

      //mapStore.setCurrentWmtsCap(mapStore.getProjection());
      // if(mapStore.plink){
      //   const plink = mapStore.plink as any;
      //   map.addControl(plink);
      // }

      dragAreaOverlay.value = new OlOverlay({
        element: dragAreaEl,
        offset: [8, -8],
        positioning: 'bottom-left',
        stopEvent: false
      })
      map.addOverlay(dragAreaOverlay.value as unknown as import('ol/Overlay').default)
      await updateReqMapView('SrMap onMounted', canRestoreZoomCenter(map))

      // Add graticule layer AFTER view is set - it needs the view to calculate grid lines
      const graticule = mapStore.getOrCreateGraticule(map)
      map.addLayer(graticule)

      logger.debug('Graticule layer added to map after view set', {
        visible: graticule.getVisible(),
        zIndex: graticule.getZIndex(),
        opacity: graticule.getOpacity()
      })

      map.getView().on('change:resolution', () => {
        //const zoom = map.getView().getZoom();
        //console.log('Current zoom level:', zoom);  // logs the zoom level
        pinVectorLayer.changed() // forces pin features to re-evaluate their styles
      })
      map?.on('click', (evt) => {
        if (isDrawing.value) {
          featureMenuOverlayRef.value?.hideMenu()
          return
        }
        const features: Feature<Geometry>[] = []
        logger.debug('Map click event', { recordsLayer })
        map.forEachFeatureAtPixel(
          evt.pixel,
          (feature: FeatureLike) => {
            if (feature instanceof Feature) {
              features.push(feature as Feature<Geometry>)
            }
          },
          {
            layerFilter: (layer) => ['Records Layer', 'Pin Layer'].includes(layer.get('name'))
          }
        )

        const pointerEvent = evt.originalEvent as MouseEvent
        if (features.length && pointerEvent) {
          featureMenuOverlayRef.value?.showMenu(
            pointerEvent.clientX,
            pointerEvent.clientY,
            features
          )
        } else {
          featureMenuOverlayRef.value?.hideMenu()
        }
      })
    } else {
      logger.error('Map is null in onMounted')
    }
    //dumpMapLayers(map, 'SrMap onMounted');
    // Note: addRecordLayer() is now handled by watch on isTreeLoaded + allReqIds with immediate:true
    if (haveReqPoly || haveReqPin) {
      // CRITICAL FIX: Delay drawing until after OpenLayers has rendered the updated view
      // OpenLayers rendering is asynchronous - it schedules renders on animation frames.
      // If we draw immediately after updateReqMapView, features may be rendered with
      // stale view transforms, causing visual offset even though coordinates are correct.
      // requestAnimationFrame(() => {
      //   //draw and zoom to the current reqParamsStore.poly
      //   logger.debug('Drawing polygon after requestAnimationFrame')
      drawCurrentReqPolyAndPin()
      //})
    }
  } else {
    logger.error('mapRef.value?.map is null in onMounted')
  }
  mapRef.value?.map.getLayers().forEach((layer, idx) => {
    const name = layer.get('name') || `Unnamed Layer ${idx}`
    const z = layer.getZIndex?.() ?? '(no z-index)'
    logger.debug('Layer z-index', { name, zIndex: z })
  })

  // Load tree data after map is fully initialized to ensure records display on map
  // This must come after updateReqMapView which adds the vector layers
  if (!recTreeStore.isTreeLoaded) {
    logger.debug('Loading tree data after SrMap is fully initialized')
    await recTreeStore.loadTreeData()
  }

  // Always render record layers after map is fully initialized
  // This handles the case where tree data was already loaded from a previous view
  // and the watcher with immediate:true ran before layers were added
  addRecordLayer()
})

// Call saveMapZoomState only when leaving the page
onBeforeUnmount(() => {
  logger.debug('Saving map zoom state before unmount')
  if (mapRef.value?.map) {
    saveMapZoomState(mapRef.value.map)
  } else {
    logger.error('mapRef.value?.map is null on unmount')
  }
})

onActivated(() => {
  logger.debug('SrMap activated')
})

onDeactivated(() => {
  logger.debug('SrMap deactivated')
})

function handleDrawControlCreated(drawControl: any) {
  //console.log(drawControl);
  const map = mapRef.value?.map
  if (map) {
    map.addControl(drawControl)
  } else {
    logger.error('Map is null in handleDrawControlCreated')
  }
}

function handleRasterizeControlCreated(rasterizeControl: any) {
  const map = mapRef.value?.map
  if (map) {
    map.addControl(rasterizeControl)
  } else {
    logger.error('Map is null in handleRasterizeControlCreated')
  }
}

function handleRasterizeChanged(enabled: boolean) {
  if (!drawnPolygonFeature.value) {
    logger.debug('No drawn polygon feature to update style')
    return
  }

  // Create style with or without fill based on rasterize state
  const newStyle = new Style({
    stroke: new Stroke({
      color: 'Red',
      width: 2
    }),
    fill: enabled
      ? new Fill({
          color: 'rgba(255, 0, 0, 0.2)' // Red fill with 20% opacity when rasterize is enabled
        })
      : undefined
  })

  drawnPolygonFeature.value.setStyle(newStyle)
  logger.debug('Updated polygon style', { rasterizeEnabled: enabled })
}

function handlePinDropControlCreated(pinDropControl: any) {
  //console.log(drawControl);
  const map = mapRef.value?.map
  if (map) {
    map.addControl(pinDropControl)
  } else {
    logger.error('Map is null in handlePinDropControlCreated')
  }
}

function handleViewControlCreated(viewControl: any) {
  //console.log(viewControl);
  const map = mapRef.value?.map
  if (map) {
    //console.log("adding viewControl");
    map.addControl(viewControl)
  } else {
    logger.error('Map is null in handleViewControlCreated')
  }
}

function handleBaseLayerControlCreated(baseLayerControl: any) {
  //console.log(baseLayerControl);
  const map = mapRef.value?.map
  if (map) {
    //console.log("adding baseLayerControl");
    map.addControl(baseLayerControl)
  } else {
    logger.error('Map is null in handleBaseLayerControlCreated')
  }
}

function handleGraticuleControlCreated(graticuleControl: any) {
  const map = mapRef.value?.map
  if (map) {
    map.addControl(graticuleControl)
  } else {
    logger.error('Map is null in handleGraticuleControlCreated')
  }
}

function handleUploadRegionControlCreated(uploadControl: any) {
  const map = mapRef.value?.map
  if (map) {
    map.addControl(uploadControl)
  } else {
    logger.error('Map is null in handleUploadRegionControlCreated')
  }
}

function handleExportPolygonControlCreated(exportControl: any) {
  const map = mapRef.value?.map
  if (map) {
    map.addControl(exportControl)
  } else {
    logger.error('Map is null in handleExportPolygonControlCreated')
  }
}

function addRecordLayer(): void {
  const startTime = performance.now() // Start time
  const reqIds = recTreeStore.allReqIds
  const selectedReqId = recTreeStore.selectedReqId
  const map = mapRef.value?.map
  if (map) {
    // Clear existing features from records and pin layers before re-rendering
    // This ensures features are rendered in the current projection's coordinate system
    recordsVectorSource.clear()
    pinVectorSource.clear()

    assignStyleFunctionToPinLayer(map, useMapStore().getMinZoomToShowPin())
    reqIds.forEach((reqId) => {
      try {
        // Skip the currently selected request - it's being edited on Drawing Layer
        // Only render it if it's a different request (for viewing past requests)
        if (reqId === selectedReqId && reqParamsStore.poly) {
          logger.debug('Skipping selected reqId in addRecordLayer (it is on Drawing Layer)', {
            reqId
          })
          return
        }

        const api = recTreeStore.findApiForReqId(reqId)
        if (api.includes('atl13')) {
          renderSvrReqPin(map, reqId).catch((error) => {
            logger.error('renderSvrReqPin failed in addRecordLayer', {
              reqId,
              error: error instanceof Error ? error.message : String(error)
            })
          })
        }
        renderSvrReqPoly(map, reqId).catch((error) => {
          logger.error('renderSvrReqPoly failed in addRecordLayer', {
            reqId,
            error: error instanceof Error ? error.message : String(error)
          })
        })
        renderSvrReqRegionMask(map, reqId).catch((error) => {
          logger.error('renderSvrReqRegionMask failed in addRecordLayer', {
            reqId,
            error: error instanceof Error ? error.message : String(error)
          })
        })
      } catch (error) {
        logger.error('Synchronous error in addRecordLayer loop', {
          reqId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })
  } else {
    logger.debug('Skipping addRecordLayer when map is null')
  }
  const endTime = performance.now() // End time
  logger.debug('addRecordLayer performance', {
    reqIdsCount: reqIds.length,
    durationMs: endTime - startTime
  })
}

function drawCurrentReqPolyAndPin() {
  const map = mapRef.value?.map
  if (map) {
    const vectorLayer = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('name') === 'Drawing Layer')
    if (vectorLayer && vectorLayer instanceof Layer) {
      const vectorSource = vectorLayer.getSource()
      if (vectorSource) {
        // Draw the raw polygon
        if (reqParamsStore.poly) {
          renderRequestPolygon(map, reqParamsStore.poly, 'red')
        }

        // Always recalculate convex hull right before drawing
        if (reqParamsStore.poly && reqParamsStore.poly.length > 0) {
          const hull = convexHull(reqParamsStore.poly)
          reqParamsStore.setConvexHull(hull)

          if (hull && hull.length > 0) {
            // Draw convex hull in a different color (using hullColor)
            renderRequestPolygon(map, hull, hullColor, 0, 'Drawing Layer', false)
          }
        }

        // check and see if pinCoordinate is defined
        if (reqParamsStore.useAtl13Point) {
          if (reqParamsStore.atl13.coord) {
            renderReqPin(map, reqParamsStore.atl13.coord)
          }
        }
        const reqGeoJsonData = useGeoJsonStore().getReqGeoJsonData()
        if (reqGeoJsonData) {
          //console.log("drawCurrentReqPolyAndPin drawing reqGeoJsonData:",geoJsonData);
          drawGeoJson('reqGeoJson', vectorSource, reqGeoJsonData, 'red', true)
        }
      } else {
        logger.error('VectorSource is null in drawCurrentReqPolyAndPin')
      }
    } else {
      logger.error('VectorLayer is null in drawCurrentReqPolyAndPin')
    }
  } else {
    logger.error('Map is null in drawCurrentReqPolyAndPin')
  }
}

/**
 * Apply extent-based filtering to a vector layer for polar projections.
 * Features outside the projection's valid extent are temporarily removed
 * from the source to prevent transformation errors.
 *
 * @param vectorLayer - The vector layer to filter
 * @param targetProjection - Target projection name (e.g., "EPSG:5936")
 * @param currentMap - The current map (to get current projection)
 */
const applyProjectionExtentFiltering = (
  vectorLayer: VectorLayer<VectorSource>,
  targetProjection: string,
  currentMap: OLMap | undefined
) => {
  try {
    const source = vectorLayer.getSource()
    if (!source) {
      return
    }

    // Check if this is a polar projection that needs filtering
    const isPolarProjection =
      targetProjection === 'EPSG:5936' ||
      targetProjection === 'EPSG:3413' ||
      targetProjection === 'EPSG:3031'

    const features = source.getFeatures()
    if (features.length === 0) {
      return
    }

    // Store filtered features on the layer for later restoration
    const filteredFeatures: Feature<Geometry>[] = []

    if (isPolarProjection) {
      // Get current map projection to transform coordinates to WGS84
      const currentProjection = currentMap?.getView().getProjection()
      const currentProjCode = currentProjection?.getCode() || 'EPSG:3857'

      logger.debug('Filtering features for polar projection', {
        targetProjection,
        currentProjection: currentProjCode,
        featureCount: features.length
      })

      features.forEach((feature) => {
        const geometry = feature.getGeometry()
        if (!geometry) {
          return
        }

        try {
          // Get the first coordinate to check (representative of the feature location)
          const geometryType = geometry.getType()
          let testCoord: Coordinate | null = null

          if (geometryType === 'Point') {
            const point = geometry as Point
            testCoord = point.getCoordinates()
          } else if (geometryType === 'Polygon') {
            const polygon = geometry as Polygon
            const coords = polygon.getCoordinates()[0]
            if (coords.length > 0) {
              testCoord = coords[0]
            }
          } else if (geometryType === 'LineString') {
            const lineString = geometry as any
            const coords = lineString.getCoordinates()
            if (coords.length > 0) {
              testCoord = coords[0]
            }
          }

          if (testCoord) {
            // First check if the source coordinate is valid
            if (!Number.isFinite(testCoord[0]) || !Number.isFinite(testCoord[1])) {
              logger.warn('Invalid source coordinate found, removing feature', {
                coord: testCoord,
                geometryType
              })
              filteredFeatures.push(feature)
              source.removeFeature(feature)
              return
            }

            // Transform coordinates from current projection to WGS84
            let wgs84Coord: Coordinate
            try {
              wgs84Coord = toLonLat(testCoord, currentProjCode)
            } catch (error) {
              logger.warn('Failed to transform coordinate to WGS84, removing feature', {
                error: error instanceof Error ? error.message : String(error),
                testCoord,
                currentProjCode
              })
              filteredFeatures.push(feature)
              source.removeFeature(feature)
              return
            }

            const [lon, lat] = wgs84Coord

            // Validate transformed coordinates are finite
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
              logger.warn('Invalid WGS84 coordinates after transformation, removing feature', {
                original: testCoord,
                transformed: wgs84Coord
              })
              filteredFeatures.push(feature)
              source.removeFeature(feature)
              return
            }

            // Check if within projection extent
            const isInExtent = isCoordinateInProjectionExtent(lon, lat, targetProjection)
            if (!isInExtent) {
              filteredFeatures.push(feature)
              source.removeFeature(feature)
            }
          }
        } catch (error) {
          logger.warn('Error checking feature extent', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })

      if (filteredFeatures.length > 0) {
        // Store filtered features on the layer so they can be restored later
        vectorLayer.set('filteredFeatures', filteredFeatures)
        logger.info('Filtered features for polar projection', {
          projection: targetProjection,
          filtered: filteredFeatures.length,
          remaining: source.getFeatures().length
        })
      }
    } else {
      // For non-polar projections, restore any previously filtered features
      const previouslyFiltered = vectorLayer.get('filteredFeatures') as
        | Feature<Geometry>[]
        | undefined
      if (previouslyFiltered && previouslyFiltered.length > 0) {
        previouslyFiltered.forEach((feature) => {
          source.addFeature(feature)
        })
        vectorLayer.unset('filteredFeatures')
        logger.info('Restored filtered features for non-polar projection', {
          restored: previouslyFiltered.length
        })
      }
    }
  } catch (error) {
    logger.error('applyProjectionExtentFiltering failed', {
      targetProjection,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

const updateReqMapView = async (reason: string, restoreView: boolean = false) => {
  logger.debug('updateReqMapView started', { reason, restoreView })
  const map = mapRef.value?.map
  try {
    if (map) {
      const srViewObj = mapStore.getSrViewObj()
      const srViewKey = findSrViewKey(mapStore.getSelectedView(), mapStore.getSelectedBaseLayer())
      if (srViewKey.value) {
        // Filter features BEFORE changing projection to prevent transformation errors
        applyProjectionExtentFiltering(drawVectorLayer, srViewObj.projectionName, map)
        applyProjectionExtentFiltering(pinVectorLayer, srViewObj.projectionName, map)
        applyProjectionExtentFiltering(recordsLayer, srViewObj.projectionName, map)
        applyProjectionExtentFiltering(uploadedFeaturesVectorLayer, srViewObj.projectionName, map)
        applyProjectionExtentFiltering(bathymetryFeaturesVectorLayer, srViewObj.projectionName, map)

        await updateMapView(map, srViewKey.value, reason, restoreView)
        map.addLayer(drawVectorLayer)
        map.addLayer(pinVectorLayer)
        map.addLayer(recordsLayer)
        map.addLayer(uploadedFeaturesVectorLayer)
        map.addLayer(bathymetryFeaturesVectorLayer)
        addLayersForCurrentView(map, srViewObj.projectionName)

        // Add polar overlay for polar projections
        removePolarOverlay(map) // Clear any existing polar overlay
        addPolarOverlay(map, srViewObj.projectionName)
      } else {
        logger.error('srViewKey is null in updateReqMapView', { reason })
      }
    } else {
      logger.error('Map is null in updateReqMapView', { reason })
    }
  } catch (error) {
    logger.error('updateMapView failed', {
      reason,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    if (map) {
      //dumpMapLayers(map,'SrMap updateMapView');
    } else {
      logger.error('Map is null in updateReqMapView finally block', { reason })
    }
    //console.log("SrMap mapRef.value?.map.getView()",mapRef.value?.map.getView());
    logger.debug('updateReqMapView completed', { reason })
  }
}

const handleUpdateSrView = async () => {
  const srViewKey = findSrViewKey(mapStore.getSelectedView(), mapStore.getSelectedBaseLayer())
  if (srViewKey.value) {
    logger.debug('handleUpdateSrView', { srViewKey: srViewKey.value })
    const map = mapRef.value?.map
    try {
      if (map) {
        saveMapZoomState(map)
        await updateReqMapView('handleUpdateSrView', false) // Don't restore - use projection defaults
        addRecordLayer() // this happens asynchronously after changing view
      } else {
        logger.error('Map is null in handleUpdateSrView')
      }
    } catch (error) {
      logger.error('handleUpdateSrView failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    logger.error('srViewKey is null in handleUpdateSrView')
  }
}

const handleUpdateBaseLayer = async () => {
  const baseLayer = mapStore.getSelectedBaseLayer()
  const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer)
  if (srViewKey.value) {
    await updateSrViewName(srViewKey.value) // Update the SrViewName in the DB based on the current selection
  } else {
    logger.error("srViewKey is null, can't update base layer")
    return
  }
  logger.debug('handleUpdateBaseLayer', { baseLayer })
  const map = mapRef.value?.map
  try {
    if (map) {
      const view = map.getView()
      mapStore.setExtentToRestore(view.calculateExtent(map.getSize()))
      const center = view.getCenter()
      if (center) {
        mapStore.setCenterToRestore(center)
      } else {
        logger.error('Center is null in handleUpdateBaseLayer')
      }
      const zoom = view.getZoom()
      if (zoom) {
        mapStore.setZoomToRestore(zoom)
      } else {
        logger.error('Zoom is null in handleUpdateBaseLayer')
      }
      saveMapZoomState(map)
      await updateReqMapView('handleUpdateBaseLayer', true)
    } else {
      logger.error('Map is null in handleUpdateBaseLayer')
    }
  } catch (error) {
    logger.error('handleUpdateBaseLayer failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// Watch for tree to load and reqIds changes
watch(
  () => ({ isLoaded: recTreeStore.isTreeLoaded, reqIds: recTreeStore.allReqIds }),
  (newVal, oldVal) => {
    if (!newVal.isLoaded) {
      logger.debug('Skipping addRecordLayer: tree not yet loaded')
      return
    }
    logger.debug('Request IDs changed', {
      oldCount: oldVal?.reqIds?.length,
      newCount: newVal.reqIds.length,
      isTreeLoaded: newVal.isLoaded
    })
    void addRecordLayer()
  },
  { deep: true, immediate: true }
) // Options to ensure it works for arrays and triggers initially

// eslint-disable-next-line no-unused-vars
let dropPinClickListener: ((evt: any) => void) | null = null

watch(
  () => reqParamsStore.iceSat2SelectedAPI,
  (newValue, oldValue) => {
    logger.debug('ICESat-2 API changed', { oldAPI: oldValue, newAPI: newValue })
    if (newValue === 'atl13x') {
      //console.log("ICESat-2 Inland Bodies of Water selected.");
      clearDrawingLayer()
      clearPolyCoords()
    } else {
      mapStore.dropPinEnabled = false
      // 🔴 Remove dropped pin
      reqParamsStore.removePin()
      reqParamsStore.useAtl13RefId = false
      logger.debug('Dropped pin removed due to API change')
    }
  }
)

watch(
  () => mapStore.dropPinEnabled,
  (newValue) => {
    //console.log(`SrMap watch reqParamsStore.dropPinEnabled changed to ${newValue}`);
    const map = mapRef.value?.map
    if (!map) {
      logger.error('Map is not available in dropPinEnabled watcher')
      return
    }

    const targetElement = map.getTargetElement()

    if (newValue) {
      recordsLayer.setVisible(false) // Hide records layer while dropping pin
      targetElement.style.cursor = 'crosshair'
      dropPinClickListener = function (evt) {
        const coordinate = evt.coordinate
        reqParamsStore.dropPin(toLonLat(coordinate, map.getView().getProjection()))

        // Clear previous pin(s)
        pinVectorSource.clear()

        // Create new pin feature
        const pointFeature = new Feature({
          geometry: new Point(coordinate),
          name: 'Dropped Pin'
        })

        pinVectorSource.addFeature(pointFeature)

        // --- Zoom logic here ---
        const minZoom = mapStore.getMinZoomToShowPin()
        const view = map.getView()
        const currentZoom = view.getZoom()
        if (currentZoom) {
          if (currentZoom < minZoom) {
            view.animate({ center: coordinate, zoom: minZoom, duration: 250 })
          } else {
            // If already at or above minZoom, just center the view
            view.animate({ center: coordinate, duration: 250 })
          }
        } else {
          logger.error('Current zoom level is null, cannot animate view')
        }

        map.getTargetElement().style.cursor = ''
        map.un('click', dropPinClickListener!)
        dropPinClickListener = null
        mapStore.dropPinEnabled = false
      }

      map.on('click', dropPinClickListener)
    } else {
      recordsLayer.setVisible(true) // Show records layer when not dropping pin
      targetElement.style.cursor = ''
      if (dropPinClickListener) {
        map.un('click', dropPinClickListener)
        dropPinClickListener = null
      }
    }
  }
)
watch(
  () => reqParamsStore.atl13.coord,
  (newValue, oldValue) => {
    logger.debug('ATL13 coord changed', { oldValue, newValue })
    if (newValue === null) {
      // Remove the pin from map
      pinVectorSource.clear()
    }
  }
)
watch(
  showBathymetryFeatures,
  (newValue) => {
    //console.log(`SrMap watch showBathymetryFeatures changed to ${newValue} defaultBathymetryFeaturesLoaded: ${defaultBathymetryFeaturesLoaded.value}`);
    if (defaultBathymetryFeaturesLoaded.value === false) {
      void loadDefaultBathymetryFeatures()
    }
    if (newValue) {
      // Show bathymetry features
      bathymetryFeaturesVectorLayer.setVisible(true)
    } else {
      // Hide bathymetry features
      bathymetryFeaturesVectorLayer.setVisible(false)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <div class="sr-main-map-container">
      <div id="map-center-highlight" />
      <Map.OlMap
        ref="mapRef"
        @error="handleEvent"
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
        ></MapControls.OlMousePositionControl>
        <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />

        <MapControls.OlScaleLineControl />
        <SrDrawControl
          ref="srDrawControlRef"
          v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x' || reqParamsStore.useAtl13Polygon"
          @draw-control-created="handleDrawControlCreated"
          @picked-changed="handlePickedChanged"
        />
        <SrRasterizeControl
          v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x' || reqParamsStore.useAtl13Polygon"
          @rasterize-control-created="handleRasterizeControlCreated"
          @rasterize-changed="handleRasterizeChanged"
          corner="top-left"
          :offsetX="'0.125rem'"
          :offsetY="'18.5rem'"
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
          v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x'"
          :reportUploadProgress="true"
          :loadReqPoly="false"
          corner="top-right"
          :offsetX="'0.5rem'"
          :offsetY="'3rem'"
          bg="rgba(255,255,255,0.6)"
          color="black"
          @upload-region-control-created="handleUploadRegionControlCreated"
        />
        <SrDropPinControl
          v-if="reqParamsStore.iceSat2SelectedAPI === 'atl13x'"
          @drop-pin-control-created="handlePinDropControlCreated"
        />
        <SrUploadRegionControl
          v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x'"
          :reportUploadProgress="true"
          :loadReqPoly="true"
          corner="top-left"
          :offsetX="'0.5rem'"
          :offsetY="'22rem'"
          @upload-region-control-created="handleUploadRegionControlCreated"
        />
        <SrExportPolygonControl
          v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x'"
          :map="mapRef?.map"
          corner="top-left"
          :offsetX="'0.5rem'"
          :offsetY="'24.25rem'"
          @export-polygon-control-created="handleExportPolygonControlCreated"
        />
      </Map.OlMap>
      <SrMapDebugInfo v-if="debugStore.showDebugPanel" :map="mapRef?.map" />
    </div>
    <SrCustomTooltip ref="tooltipRef" id="MainMapTooltip" />
    <SrFeatureMenuOverlay ref="featureMenuOverlayRef" @select="onFeatureMenuSelect" />
  </div>
</template>

<style scoped>
:deep(.sr-main-map-container) {
  position: relative;
  height: 100%;
  width: 100%;
  border-radius: 1rem;
  margin: 1rem;
  flex: 1 1 auto; /* grow, shrink, basis - let it stretch*/
}

:deep(.sr-ol-map) {
  min-width: 15rem;
  min-height: 15rem;
  border-radius: var(--p-border-radius);
  width: 70vw;
  height: 88vh;
  overflow: hidden;
}

.sr-tooltip-style {
  position: absolute;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  pointer-events: none;
  font-size: 1rem;
}
:deep(.ol-overlaycontainer-stopevent) {
  position: relative;
  display: flex !important;
  flex-direction: column; /* Stack children vertically */
  justify-content: flex-start; /* Align children to the top */
  align-items: flex-end; /* Align children to the right */
  height: 100%; /* Ensure the container has height */
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

/* Attribution positioning - styling is in sr-common-styles.css */
:deep(.ol-attribution) {
  bottom: 0.5rem;
  top: auto;
  left: auto;
}

/* ScaleLine control positioning - styling is in sr-common-styles.css */
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
/* Size the launcher square */
:deep(.ol-control.ol-layerswitcher > button) {
  width: 2rem; /* your target box */
  height: 2rem;
  padding: 0; /* remove inner padding */
  background: transparent;
  display: grid; /* perfectly center the icon */
  place-items: center;
  line-height: 1; /* don't shrink the icon */
  font-size: 1.4rem; /* <— grows the icon (base for ::before/::after) */
}

/* Make the glyphs use more of the box */
:deep(.ol-control.ol-layerswitcher > button::before),
:deep(.ol-control.ol-layerswitcher > button::after) {
  margin: 0; /* reset any theme offsets */
  line-height: 1;
}

/* 2) Panel width */
:deep(.ol-control.ol-layerswitcher .panel-container) {
  width: 22rem; /* <- change me */
  max-width: 90vw;
}

/* 3) Panel max height + scrolling */
:deep(.ol-control.ol-layerswitcher .panel) {
  max-height: 55vh; /* <- change me */
  overflow: auto;
}

/* Optional: compact list items & checkbox hit-box */
:deep(.ol-layerswitcher .panel .li-content) {
  padding: 0.25rem 0.5rem;
}
:deep(.ol-layerswitcher .panel .li-content > label) {
  font-size: 0.95rem; /* text size */
}
:deep(.ol-layerswitcher .panel .li-content > label::before) {
  width: 0.95rem;
  height: 0.95rem; /* checkbox size */
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

:deep(.ol-geocoder) {
  top: 2.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background: transparent;
  border: none;
  padding: 0;
  color: black;
  max-width: 30rem;
}

:deep(.gcd-gl-control) {
  background-color: transparent;
}

:deep(.ol-geocoder .gcd-gl-btn) {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent) !important;
  border: none !important;
  border-radius: var(--p-border-radius);
  color: black;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  box-sizing: border-box;
}

:deep(.ol-geocoder .gcd-gl-btn:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent) !important;
  border: none !important;
}

:deep(.ol-geocoder button) {
  color: black;
  background: transparent;
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

:deep(.sr-select-menu-default) {
  padding: 0;
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

:deep(.ol-ext-dialog .ol-content .ol-wmscapabilities .ol-url .url) {
  color: white;
  background-color: var(--p-primary-600);
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

:deep(.ol-wmscapabilities .ol-url button) {
  color: white;
  border-radius: var(--p-border-radius);
  background-color: var(--p-primary-400);
}

:deep(.ol-wmscapabilities .ol-url option) {
  color: white;
  background-color: var(--p-primary-400);
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

/* Scale up control buttons on touch devices to match OpenLayers zoom buttons */
:deep(.ol-touch .sr-draw-control),
:deep(.ol-touch .sr-rasterize-control),
:deep(.ol-touch .sr-upload-region-control),
:deep(.ol-touch .sr-export-polygon-control),
:deep(.ol-touch .ol-geocoder .gcd-gl-btn) {
  font-size: 1.5em;
}

:deep(.sr-drop-pin-control) {
  top: 20rem;
  left: 0.5rem;
  right: auto;
  border-radius: var(--p-border-radius);
}

:deep(.ol-mouse-position) {
  bottom: 0.5rem; /* Position from the bottom */
  left: 50%; /* Center align horizontally */
  right: auto; /* Reset right positioning */
  top: auto; /* Unset top positioning */
  transform: translateX(-50%); /* Adjust for the element's width */
  color: black;
  background: color-mix(in srgb, var(--p-primary-color) 25%, transparent);
  border-radius: var(--p-border-radius);
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  width: fit-content; /* Only as wide as content needs */
  white-space: nowrap; /* Prevent text wrapping */
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

.hidden-control {
  display: none;
}

.ol-marker-label {
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  border: 1px solid #ccc;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

/* SrMap.vue (scoped with :deep) or a global stylesheet */
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

:deep(.ol-control.sr-export-polygon-control) {
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

:deep(.ol-control.sr-export-polygon-control:hover) {
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
  /* if something upstream sets opacity, force full */
  opacity: 1;
}

/* Graticule styling - ensure labels aren't clipped */
:deep(.ol-layer canvas) {
  /* Allow graticule labels to overflow without being clipped */
  overflow: visible !important;
}
</style>
