<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type OLMap from 'ol/Map.js'
import ProgressSpinner from 'primevue/progressspinner'
import { srProjections } from '@/composables/SrProjections'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import 'ol/ol.css'
import 'ol-geocoder/dist/ol-geocoder.min.css'
import { get as getProjection } from 'ol/proj.js'
import SrLegendControl from '@/components/SrLegendControl.vue'
import { zoomMapForReqIdUsingView } from '@/utils/SrMapUtils'
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore'
import { useRequestsStore } from '@/stores/requestsStore'
import { Map, MapControls } from 'vue3-openlayers'
import { db } from '@/db/SlideRuleDb'
import { type Coordinate } from 'ol/coordinate'
import { toLonLat } from 'ol/proj'
import { format } from 'ol/coordinate'
import { updateMapView, renderSvrReqPoly, resetFilterUsingSelectedRec } from '@/utils/SrMapUtils'
import SrRecSelectControl from '@/components/SrRecSelectControl.vue'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import SrColMapSelControl from '@/components/SrColMapSelControl.vue'
import { useSrToastStore } from '@/stores/srToastStore'
import { readOrCacheSummary } from '@/utils/SrDuckDbUtils'
import { Vector as VectorSource } from 'ol/source'
import VectorLayer from 'ol/layer/Vector'
import { updateMapAndPlot } from '@/utils/SrMapUtils'
import { useDeckStore } from '@/stores/deckStore'
import SrProgressSpinnerControl from '@/components/SrProgressSpinnerControl.vue'
import { useAnalysisMapStore } from '@/stores/analysisMapStore'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { useChartStore } from '@/stores/chartStore'
import { callPlotUpdateDebounced } from '@/utils/plotUtils'
import { setCyclesGtsSpotsFromFileUsingRgtYatc, updateSrViewName } from '@/utils/SrMapUtils'
import Checkbox from 'primevue/checkbox'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import { useDebugStore } from '@/stores/debugStore'
import SrBaseLayerControl from '@/components/SrBaseLayerControl.vue'
import SrGraticuleControl from '@/components/SrGraticuleControl.vue'
import { findSrViewKey, srViews } from '@/composables/SrViews'
import { addLayersForCurrentView } from '@/composables/SrLayers'
import { useGoogleApiKeyStore } from '@/stores/googleApiKeyStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import { selectSrViewForExtent } from '@/utils/srViewSelector'
import SrLocationFinder from '@/components/SrLocationFinder.vue'
import { useActiveTabStore } from '@/stores/activeTabStore'
import type { Control } from 'ol/control'
import { View as OlView } from 'ol'
import { createLogger } from '@/utils/logger'
import { useMapDeckOverlay } from '@/composables/useMapDeckOverlay'
import { usePolarOverlay } from '@/composables/usePolarOverlay'

const DECK_VIEW_ID = 'ol-deck-view'

const logger = createLogger('SrAnalysisMap')
const { createDeckInstance, addDeckLayerToMap } = useMapDeckOverlay({
  deckViewId: DECK_VIEW_ID,
  getLogger: () => logger,
  getMap: () => mapRef.value?.map
})

// Initialize polar overlay composable - always visible
const { addPolarOverlay, removePolarOverlay } = usePolarOverlay({
  latitudeThreshold: 88,
  color: '#FF0000',
  opacity: 0.25,
  zIndex: 100
})

const template = '{y}\u00B0, {x}\u00B0'
const stringifyFunc = (coordinate: Coordinate) => {
  const projName = computedProjName.value
  let newProj = getProjection(projName)
  let newCoord = coordinate
  if (newProj?.getUnits() !== 'degrees') {
    newCoord = toLonLat(coordinate, projName)
  }
  return format(newCoord, template, 4)
}
const mapContainer = ref<HTMLElement | null>(null)
const mapRef = ref<{ map: OLMap }>()
const legendRef = ref<any>()
const mapStore = useMapStore()
const requestsStore = useRequestsStore()
const recTreeStore = useRecTreeStore()
const deckStore = useDeckStore()
const srParquetCfgStore = useSrParquetCfgStore()
const analysisMapStore = useAnalysisMapStore()
const globalChartStore = useGlobalChartStore()
const fncs = useFieldNameStore()
const atlChartFilterStore = useAtlChartFilterStore()
const activeTabStore = useActiveTabStore()
const fieldNameStore = useFieldNameStore()
const debugStore = useDebugStore()
const googleApiKeyStore = useGoogleApiKeyStore()
const controls = ref([])
const tooltipRef = ref<InstanceType<typeof SrCustomTooltip> | null>(null)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
// true whenever the active tab is _not_ "3‑D View"
const isNot3DView = computed(() => !activeTabStore.isActiveTabLabel('3-D View'))

const hasOffPointFilter = computed(() => {
  return recTreeStore.selectedApi === 'atl13x'
    ? activeTabStore.isActiveTabElevation &&
        useFieldNameStore().getMissionForReqId(props.selectedReqId) === 'ICESat-2'
    : isNot3DView.value
})

const hasLinkToElevationPlot = computed(() => {
  return activeTabStore.isActiveTabElevation || activeTabStore.isActiveTab3D
})

const recordsVectorSource = new VectorSource({ wrapX: false })
const recordsLayer = new VectorLayer({
  source: recordsVectorSource,
  minZoom: 0,
  maxZoom: 28 // Allow rendering at all zoom levels, but features will be clipped by projection extent
})

const mapRefComputed = computed(() => {
  return mapRef.value?.map
})

const locationFinderReady = computed(() => {
  return mapRefComputed.value != null && mapRefComputed.value != undefined
})

const handleEvent = (event: any) => {
  logger.debug('Map event', { event })
}
const computedProjName = computed(() => mapStore.getSrViewObj().projectionName)

// Track current zoom level (DEBUG)
const currentZoom = ref<number>(0)
let zoomListener: any = null
let attachedView: OlView | null = null
let originalErrorHandler: OnErrorEventHandler | null = null

const detachViewListeners = () => {
  if (attachedView && zoomListener) {
    attachedView.un('change:resolution', zoomListener)
    attachedView.un('change:center', zoomListener)
    attachedView.un('change', zoomListener)
  }
  attachedView = null
  zoomListener = null
}

const attachViewListeners = (view?: OlView | null) => {
  if (!view) return
  detachViewListeners()
  attachedView = view

  zoomListener = () => {
    const zoom = view.getZoom()
    const center = view.getCenter()
    const mapSize = mapRef.value?.map.getSize()
    const extent = mapSize ? view.calculateExtent(mapSize) : undefined
    if (zoom !== undefined && center && extent) {
      currentZoom.value = zoom
      logger.debug('View changed', {
        zoom,
        center,
        extent,
        projection: computedProjName.value
      })
    }
  }

  const mapSize = mapRef.value?.map.getSize()
  const initialZoom = view.getZoom()
  const initialCenter = view.getCenter()
  const initialExtent = mapSize ? view.calculateExtent(mapSize) : undefined
  if (initialZoom !== undefined && initialCenter && initialExtent) {
    currentZoom.value = initialZoom
    logger.debug('Initial view set', {
      zoom: initialZoom,
      center: initialCenter,
      extent: initialExtent,
      projection: computedProjName.value
    })
  }

  view.on('change:resolution', zoomListener)
  view.on('change:center', zoomListener)
  view.on('change', zoomListener)
}

// Cleanup listeners and error handler on unmount
onBeforeUnmount(() => {
  detachViewListeners()
  // Restore original error handler
  if (originalErrorHandler !== null) {
    window.onerror = originalErrorHandler
  }
  // Clean up context menu event listeners
  if (mapContainer.value) {
    mapContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }
  document.removeEventListener('click', closeContextMenu)
})

const elevationIsLoading = computed(
  () => analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading
)
const loadStateStr = computed(() => {
  return elevationIsLoading.value ? 'Loading' : 'Loaded'
})
const chartStore = useChartStore()
// Track the color field currently displayed on the map (not just selected in dropdown)
const currentMapColorField = ref<string>('')

// Update the map color field - call this when the map actually updates
const updateCurrentMapColorField = () => {
  const selectedColorField = chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr)
  if (selectedColorField && selectedColorField !== 'solid' && selectedColorField !== 'unset') {
    currentMapColorField.value = selectedColorField
  } else {
    currentMapColorField.value = fncs.getHFieldName(recTreeStore.selectedReqId)
  }
}

const computedLegendDataKey = computed(() => {
  // Use the current map color field, or fall back to height field if not yet set
  if (currentMapColorField.value) {
    return currentMapColorField.value
  }
  return fncs.getHFieldName(recTreeStore.selectedReqId)
})

// Watch for color encoding changes - only update legend when "Link to Plot" is enabled
watch(
  () => chartStore.getSelectedColorEncodeData(recTreeStore.selectedReqIdStr),
  () => {
    if (globalChartStore.enableLocationFinder) {
      updateCurrentMapColorField()
    }
  }
)

const computedMission = computed(() => {
  return fncs.getMissionForReqId(recTreeStore.selectedReqId)
})
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const computedLoadMsg = computed(() => {
  const currentRowsFormatted = numberFormatter.format(
    analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).currentPnts
  )
  const totalRowsFormatted = numberFormatter.format(
    analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).totalPnts
  )
  if (
    analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).currentPnts !=
    analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).totalPnts
  ) {
    return `${loadStateStr.value} Record:${recTreeStore.selectedReqIdStr} - ${recTreeStore.selectedApi} ${currentRowsFormatted} out of ${totalRowsFormatted} pnts`
  } else {
    return `${loadStateStr.value} Record:${recTreeStore.selectedReqIdStr} - ${recTreeStore.selectedApi} (${currentRowsFormatted} pnts)`
  }
})

const offFilterTooltip = computed(() => {
  if (atlChartFilterStore.showPhotonCloud) {
    return 'This is disabled when Show Photon Cloud is enabled'
  } else {
    return 'Enable/Disable off pointing filter'
  }
})

const props = withDefaults(
  defineProps<{
    selectedReqId: number
  }>(),
  {
    selectedReqId: 0
  }
)

// Watch for changes on reqId
watch(
  () => props.selectedReqId,
  async (newReqId, oldReqId) => {
    logger.debug('watch props.selectedReqId changed', { oldReqId, newReqId })
    if (newReqId !== oldReqId) {
      if (newReqId > 0) {
        await fieldNameStore.loadMetaForReqId(newReqId) // async but don't await
        globalChartStore.setAllColumnMinMaxValues({}) // reset all min/max values
        await updateAnalysisMapView('watch selectedReqId')
      } else {
        logger.error('SrAnalysisMap selectedReqId is 0')
      }
    }
  }
)

// Watch for changes on parquetReader
watch(
  () => useSrParquetCfgStore().parquetReader,
  async (newReader, oldReader) => {
    logger.debug('watch parquet reader changed', { oldReader, newReader })
    await updateAnalysisMapView('New parquetReader')
  }
)

watch(
  () => srParquetCfgStore.maxNumPntsToDisplay,
  async (newMaxNumPntsToDisplay, oldMaxNumPntsToDisplay) => {
    logger.debug('watch maxNumPntsToDisplay changed', {
      oldMaxNumPntsToDisplay,
      newMaxNumPntsToDisplay
    })
    await updateAnalysisMapView('New maxNumPntsToDisplay')
  }
)

// Watch for Google API key validation to refresh the map
watch(
  () => googleApiKeyStore.refreshTrigger,
  async (newValue, oldValue) => {
    if (newValue > oldValue) {
      logger.debug('Google API key validated, refreshing map')
      await updateAnalysisMapView('Google API key validated')
    }
  }
)

onMounted(async () => {
  logger.debug('SrAnalysisMap onMounted', { selectedReqId: props.selectedReqId })
  await fieldNameStore.loadMetaForReqId(props.selectedReqId) // async but don't await
  // Bind the tooltipRef to the store
  if (tooltipRef.value) {
    analysisMapStore.tooltipRef = tooltipRef.value
  } else {
    logger.error('tooltipRef is null on mount')
  }

  // Add context menu handler to map container
  if (mapContainer.value) {
    mapContainer.value.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', closeContextMenu)
  }
  recordsLayer.set('name', 'Records Layer') // for empty requests need to draw poly in this layer
  recordsLayer.set('title', 'Records Layer')
  //logger.debug("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
  Object.values(srProjections.value).forEach((projection) => {
    //logger.debug(`Title: ${projection.title}, Name: ${projection.name}`);
    proj4.defs(projection.name, projection.proj4def)
  })
  register(proj4)
  const map = mapRef.value?.map
  if (!map) {
    logger.error('SrAnalysisMap onMounted: map is null')
    return
  }

  const srViewName = await db.getSrViewName(props.selectedReqId)
  //logger.debug(`SrAnalysisMap onMounted: retrieved srViewName: ${srViewName} for reqId:${props.selectedReqId}`);
  let viewObj = srViews.value[srViewName]
  //logger.debug(`SrAnalysisMap onMounted: retrieved viewObj.view: ${viewObj?.view} viewObj.baseLayer:${viewObj?.baseLayerName} srViewName:${srViewName} for reqId:${props.selectedReqId}`);

  // If view not found, try to auto-select based on data extent (similar to file import)
  if (!viewObj) {
    logger.warn(
      'SrAnalysisMap onMounted: No view found for srViewName, attempting auto-selection',
      {
        srViewName,
        reqId: props.selectedReqId
      }
    )

    const summary = await readOrCacheSummary(props.selectedReqId)
    if (summary?.extLatLon) {
      const fallbackViewName = selectSrViewForExtent(summary.extLatLon)
      viewObj = srViews.value[fallbackViewName]

      if (viewObj) {
        logger.info('Auto-selected fallback view based on data extent', {
          originalViewName: srViewName,
          fallbackViewName,
          extent: summary.extLatLon,
          reqId: props.selectedReqId
        })
        useSrToastStore().info(
          'View Auto-Selected',
          `The saved view "${srViewName}" is not available. Selected "${fallbackViewName}" based on data extent.`,
          5000
        )
      } else {
        logger.error('Fallback view not found', { fallbackViewName })
        return
      }
    } else {
      logger.error('Cannot auto-select view - no extent data available', {
        reqId: props.selectedReqId,
        srViewName
      })
      return
    }
  }
  mapStore.setSelectedView(viewObj.view) // Set the selected view in the map store
  //const selectedView = mapStore.getSelectedView(); // Get the selected view
  //logger.debug(`SrAnalysisMap onMounted: selected view is ${selectedView} with srViewName: ${srViewName}`);

  if (viewObj.baseLayerName) {
    mapStore.setSelectedBaseLayer(viewObj.baseLayerName)
    //logger.debug(`SrAnalysisMap onMounted: set default baseLayer to ${viewObj.baseLayerName} for selected view ${selectedView}`);
  } else {
    logger.error('SrAnalysisMap onMounted: defaulted baseLayer is null')
  }
  await updateAnalysisMapView('onMounted')

  // Add graticule layer AFTER view is set - it needs the view to calculate grid lines
  const graticule = mapStore.getOrCreateGraticule(map)
  map.addLayer(graticule)

  logger.debug('Graticule layer added to analysis map after view set', {
    visible: graticule.getVisible(),
    zIndex: graticule.getZIndex(),
    opacity: graticule.getOpacity()
  })

  attachViewListeners(map.getView())

  // Add error handler for projection errors during rendering
  // This catches errors when vector features are rendered outside projection extent
  originalErrorHandler = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    if (typeof message === 'string' && message.includes('coordinates must be finite numbers')) {
      const currentView = mapRef.value?.map.getView()
      logger.debug(
        'Caught projection error during map rendering - likely zoom beyond projection extent',
        {
          zoom: currentView?.getZoom(),
          projectionName: computedProjName.value
        }
      )
      return true
    }
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error)
    }
    return false
  }

  void requestsStore.displayHelpfulPlotAdvice(
    'Click on a track in the map to display the elevation scatter plot'
  )
  logger.debug('SrAnalysisMap onMounted done')
})

const handleLegendControlCreated = (legendControl: Control | null) => {
  const analysisMap = mapRef.value?.map

  if (!analysisMap) {
    logger.warn('analysisMap is null, will be set in onMounted')
    return
  }

  // Remove the previous legend control if it exists
  if (legendRef.value) {
    analysisMap.removeControl(legendRef.value)
    legendRef.value = null
  }

  // Add the new legend control if provided
  if (legendControl) {
    logger.debug('adding legendControl')
    analysisMap.addControl(legendControl)
    legendRef.value = legendControl
  }
}

const handleColMapSelControlCreated = (colMapSelControl: any) => {
  const analysisMap = mapRef.value?.map
  if (analysisMap) {
    //logger.debug("adding colMapSelControl");
    analysisMap.addControl(colMapSelControl)
  } else {
    logger.error('analysisMap is null')
  }
}

function handleRecordSelectorControlCreated(recordSelectorControl: any) {
  //logger.debug("handleRecordSelectorControlCreated");
  const analysisMap = mapRef.value?.map
  if (analysisMap) {
    //logger.debug("adding baseLayerControl");
    analysisMap.addControl(recordSelectorControl)
  } else {
    logger.error('analysisMap is null')
  }
}

const handleProgressSpinnerControlCreated = (progressSpinnerControl: any) => {
  const analysisMap = mapRef.value?.map
  if (analysisMap) {
    //logger.debug("handleProgressSpinnerControlCreated Adding ProgressSpinnerControl");
    analysisMap.addControl(progressSpinnerControl)
  } else {
    logger.warn(
      'handleProgressSpinnerControlCreated: analysisMap is null, will be set in onMounted'
    )
  }
}
function handleBaseLayerControlCreated(baseLayerControl: any) {
  //logger.debug(baseLayerControl);
  const map = mapRef.value?.map
  if (map) {
    //logger.debug("adding baseLayerControl");
    map.addControl(baseLayerControl)
  } else {
    logger.error('map is null')
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

const handleUpdateBaseLayer = async () => {
  //logger.debug("SrAnalysisMap handleUpdateBaseLayer called");
  const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer)
  if (srViewKey.value) {
    await updateSrViewName(srViewKey.value) // Update the SrViewName in the DB based on the current selection
    //logger.debug("SrAnalysisMap handleUpdateBaseLayer: Updated SrViewName based on User selected view and base layer:", srViewKey.value);
  } else {
    logger.error('srViewKey is null, cannot update base layer')
    return
  }
  //logger.debug(`SrAnalysisMap handleUpdateBaseLayer: |${baseLayer}|`);
  const map = mapRef.value?.map
  try {
    if (map) {
      await updateAnalysisMapView('SrAnalysisMap handleUpdateBaseLayer')
    } else {
      logger.error('map is null')
    }
  } catch (error) {
    logger.error('handleUpdateBaseLayer failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

const updateAnalysisMapView = async (reason: string) => {
  const map = mapRef.value?.map
  const srViewName = await db.getSrViewName(props.selectedReqId)
  logger.debug('SrAnalysisMap updateAnalysisMapView start', {
    srViewName,
    reason,
    selectedReqId: props.selectedReqId
  })

  try {
    if (map) {
      // First, get the summary to check data extent for fallback view selection
      const summary = await readOrCacheSummary(props.selectedReqId)
      if (!summary) {
        logger.error('No summary for reqId', { reqId: props.selectedReqId, srViewName })
        return
      }

      // Load and set the view that was saved with this record
      let viewObj = srViews.value[srViewName]
      if (!viewObj) {
        // Fallback: Select appropriate view based on data location
        logger.warn('No view found for srViewName, selecting based on data location', {
          srViewName,
          reqId: props.selectedReqId
        })

        if (summary.extLatLon) {
          const fallbackViewName = selectSrViewForExtent(summary.extLatLon)
          viewObj = srViews.value[fallbackViewName]

          if (viewObj) {
            logger.info('Selected fallback view based on data extent', {
              originalViewName: srViewName,
              fallbackViewName,
              extent: summary.extLatLon
            })
            useSrToastStore().info(
              `View "${srViewName}" not found. Using "${fallbackViewName}" based on data location.`
            )

            // Update the stored view name for this request
            await db.updateRequestRecord(
              { req_id: props.selectedReqId, srViewName: fallbackViewName },
              false
            )
            logger.debug('Updated srViewName to fallback', {
              reqId: props.selectedReqId,
              fallbackViewName
            })
          } else {
            logger.error('Fallback view not found', { fallbackViewName })
            return
          }
        } else {
          logger.error('Cannot select fallback view - no extent data available', {
            reqId: props.selectedReqId
          })
          return
        }
      }

      // Check if the saved view is compatible with the data
      let actualViewToUse = viewObj
      const isPolarProjection =
        viewObj.projectionName === 'EPSG:5936' ||
        viewObj.projectionName === 'EPSG:3413' ||
        viewObj.projectionName === 'EPSG:3031'

      if (isPolarProjection && summary.extLatLon) {
        const { minLat, maxLat, minLon, maxLon } = summary.extLatLon
        const projection = srProjections.value[viewObj.projectionName]

        if (projection?.bbox) {
          const [projMinLon, projMinLat, projMaxLon, projMaxLat] = projection.bbox

          // Check if data extent overlaps with projection's valid extent
          const hasOverlap = !(
            maxLat < projMinLat || // Data is entirely south of projection
            minLat > projMaxLat || // Data is entirely north of projection
            maxLon < projMinLon || // Data is entirely west of projection
            minLon > projMaxLon // Data is entirely east of projection
          )

          if (!hasOverlap) {
            logger.warn('Saved view incompatible with data, falling back to Global Mercator', {
              savedView: srViewName,
              projectionName: viewObj.projectionName,
              dataExtent: { minLat, maxLat, minLon, maxLon },
              projectionBbox: projection.bbox
            })
            useSrToastStore().warn(
              'View changed for compatibility',
              `This data (lat: ${minLat.toFixed(1)}° to ${maxLat.toFixed(1)}°) cannot be displayed in ${projection.title}. Switching to Global Mercator view.`,
              8000
            )
            // Fall back to Global Mercator Esri
            actualViewToUse = srViews.value['Global Mercator Esri']
          }
        }
      }

      // Set the map store to use the compatible view
      mapStore.setSelectedView(actualViewToUse.view)
      if (actualViewToUse.baseLayerName) {
        mapStore.setSelectedBaseLayer(actualViewToUse.baseLayerName)
      }
      logger.debug('Applied view from record', {
        savedView: srViewName,
        actualView: actualViewToUse.view,
        baseLayer: actualViewToUse.baseLayerName,
        reqId: props.selectedReqId,
        fallback: actualViewToUse !== viewObj
      })

      const srViewObj = mapStore.getSrViewObj() // Fixed memory references
      const srViewKey = findSrViewKey(mapStore.getSelectedView(), mapStore.getSelectedBaseLayer())
      if (srViewKey.value) {
        updateMapView(map, srViewKey.value, reason, false, props.selectedReqId)
        addLayersForCurrentView(map, srViewObj.projectionName)

        // TEMPORARY DEBUG: Log all layers after view is set up
        logger.debug('=== ANALYSIS MAP DEBUG: AFTER updateMapView ===')
        map.getAllLayers().forEach((layer: any, index: number) => {
          const title = layer.get('title') || layer.get('name') || 'Unnamed'
          const visible = layer.getVisible()
          const opacity = layer.getOpacity()
          const zIndex = layer.getZIndex?.() ?? 'auto'
          logger.debug(
            `Layer ${index}: ${title}, Visible: ${visible}, Opacity: ${opacity}, Z-Index: ${zIndex}`
          )
        })
        logger.debug('=== VIEW INFO ===')
        logger.debug(`Projection: ${map.getView().getProjection().getCode()}`)
        logger.debug(`Current Zoom: ${map.getView().getZoom()}`)

        //logger.debug(`summary.numPoints:${summary.numPoints} srViewName:${srViewName}`);
        const numPointsStr = summary.numPoints // it is a string BIG INT!
        const numPoints = parseInt(String(numPointsStr))
        if (numPoints > 0) {
          try {
            await zoomMapForReqIdUsingView(map, props.selectedReqId, srViewName)

            // Give tiles a brief moment to start loading after zoom
            // The zoom is now constrained to valid tile availability, so this is just a courtesy delay
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (zoomError) {
            logger.warn('Failed to zoom to data extent, using default view', {
              error: zoomError instanceof Error ? zoomError.message : String(zoomError),
              projection: srViewObj.projectionName
            })
          }
        } else {
          logger.warn('No points for reqId', { reqId: props.selectedReqId, srViewName })
          useSrToastStore().warn(
            'There are no data points in this region',
            'Click Request then increase the area of the polygon',
            10000
          )
          map.addLayer(recordsLayer)
          //dumpMapLayers(map,'SrAnalysisMap');
          void renderSvrReqPoly(map, props.selectedReqId, 'Records Layer', true)
        }

        deckStore.clearDeckInstance() // Clear any existing instance first
        createDeckInstance(map)
        addDeckLayerToMap(map)
        attachViewListeners(map.getView())

        // Add polar overlay for polar projections
        removePolarOverlay(map) // Clear any existing polar overlay
        addPolarOverlay(map, srViewObj.projectionName)

        // TEMPORARY DEBUG: Log layers after deck is added
        logger.debug('=== ANALYSIS MAP DEBUG: AFTER DECK ADDED ===')
        map.getAllLayers().forEach((layer: any, index: number) => {
          const title = layer.get('title') || layer.get('name') || 'Unnamed'
          const visible = layer.getVisible()
          const opacity = layer.getOpacity()
          const zIndex = layer.getZIndex?.() ?? 'auto'
          logger.debug(
            `Layer ${index}: ${title}, Visible: ${visible}, Opacity: ${opacity}, Z-Index: ${zIndex}`
          )
        })
        const baseLayer = map.getAllLayers().find((l: any) => l.get('name') === 'Base Layer')
        if (baseLayer) {
          const source = baseLayer.getSource() as any
          logger.debug(
            'Base Layer Tile Cache Count:',
            source?.getTileCache?.()?.getCount?.() || 'N/A'
          )
        }

        await updateMapAndPlot(`SrAnalysisMap: ${reason}`)
        updateCurrentMapColorField()
      } else {
        logger.error('srViewKey is null')
      }
    } else {
      logger.error('map is null')
    }
  } catch (error) {
    logger.error('updateAnalysisMapView failed', {
      reason,
      error: error instanceof Error ? error.message : String(error)
    })

    // Extract meaningful error information
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check if it's a column not found error
    if (errorMessage.includes('Referenced column') && errorMessage.includes('not found')) {
      // Extract the column name from the error
      const columnMatch = errorMessage.match(/Referenced column "([^"]+)" not found/)
      const columnName = columnMatch ? columnMatch[1] : 'unknown'

      useSrToastStore().error(
        'Data Column Not Found',
        `The column "${columnName}" is not available in the current dataset. Please check your data configuration or select a different column for visualization.`,
        10000
      )
    } else {
      // Generic error message for other types of errors
      useSrToastStore().error(
        'Analysis Map Error',
        `Failed to update analysis map: ${errorMessage.substring(0, 150)}...`,
        10000
      )
    }
  } finally {
    if (map) {
      //dumpMapLayers(map,'SrAnalysisMap');
    } else {
      logger.error('map is null in finally block')
    }
    logger.debug('SrAnalysisMap mapRef view', { view: mapRef.value?.map.getView() })
    logger.debug('SrAnalysisMap updateAnalysisMapView done', { reason })
  }
  logger.debug('Done SrAnalysisMap updateAnalysisMapView', {
    srViewName,
    reason,
    selectedReqId: props.selectedReqId
  })
}

async function handleOffPntEnable(value: number) {
  logger.debug('SrAnalysisMap handleOffPntEnable', { value })
  if (!value) {
    logger.debug('SrAnalysisMap handleOffPntEnable: value is undefined', { value })
  }
  if (globalChartStore.y_atc_is_valid()) {
    if (value) {
      await setCyclesGtsSpotsFromFileUsingRgtYatc()
    } else {
      void resetFilterUsingSelectedRec()
    }
    await callPlotUpdateDebounced('SrAnalysisMap yatc change') // no need to debounce
  } else {
    logger.error('SrAnalysisMap handleOffPntEnable: y_atc invalid', {
      selected_y_atc: globalChartStore.selected_y_atc
    })
  }
}
function handleUseFullRangeUpdate(_value: boolean) {
  logger.debug('SrAnalysisMap handleUseFullRangeUpdate', { value: _value })
  if (_value === undefined) {
    logger.debug('SrAnalysisMap handleUseFullRangeUpdate: value is undefined', { value: _value })
  }
  void updateAnalysisMapView('SrAnalysisMap handleUseFullRangeUpdate')
}

// Save tooltip content as text file
function saveTooltipAsText() {
  if (!tooltipRef.value) {
    logger.warn('No tooltip ref available')
    return
  }

  const content = tooltipRef.value.getPlainText()
  if (!content) {
    logger.warn('No tooltip content to save')
    return
  }

  try {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    a.download = `map_tooltip_${timestamp}.txt`

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.debug('Map tooltip saved successfully')
  } catch (error) {
    logger.error('Error saving map tooltip', { error })
  }
}

// Handle context menu event
function handleContextMenu(event: MouseEvent) {
  // Only show menu if we have tooltip content
  if (tooltipRef.value && tooltipRef.value.getPlainText()) {
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
</script>

<template>
  <div class="sr-analysis-map-panel">
    <div class="sr-analysis-map-header">
      <div class="sr-isLoadingEl" v-if="elevationIsLoading">
        <ProgressSpinner
          v-if="analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading"
          animationDuration="1.25s"
          style="width: 1rem; height: 1rem"
        />
        {{ computedLoadMsg }}
      </div>
      <div class="sr-notLoadingEl" v-else>
        {{ computedLoadMsg }}
      </div>
      <!-- DEBUG: Zoom level display -->
      <div class="sr-zoom-debug" v-if="debugStore.showZoomDebug" style="margin-left: 1rem">
        Zoom: {{ currentZoom.toFixed(2) }}
      </div>
    </div>
    <div ref="mapContainer" class="sr-map-container">
      <Map.OlMap
        ref="mapRef"
        @error="handleEvent"
        :loadTilesWhileAnimating="true"
        :loadTilesWhileInteracting="true"
        :controls="controls"
        class="sr-ol-analysis-map"
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

        <MapControls.OlScaleLineControl />

        <SrLegendControl
          @legend-control-created="handleLegendControlCreated"
          :reqIdStr="recTreeStore.selectedReqIdStr"
          :data_key="computedLegendDataKey"
        >
        </SrLegendControl>
        <SrRecSelectControl
          class="sr-record-selector-control"
          @record-selector-control-created="handleRecordSelectorControlCreated"
        />
        <SrColMapSelControl
          class="sr-col-menu-sel-control"
          @col-map-sel-control-created="handleColMapSelControlCreated"
        >
        </SrColMapSelControl>
        <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />
        <SrProgressSpinnerControl
          @progress-spinner-control-created="handleProgressSpinnerControlCreated"
          v-model="mapRef"
          :selectedReqId="props.selectedReqId"
        />
        <SrBaseLayerControl
          @baselayer-control-created="handleBaseLayerControlCreated"
          @update-baselayer="handleUpdateBaseLayer"
        />
        <SrGraticuleControl @graticule-control-created="handleGraticuleControlCreated" />
        <SrLocationFinder
          v-if="
            hasLinkToElevationPlot &&
            locationFinderReady &&
            globalChartStore.enableLocationFinder &&
            mapRef?.map
          "
          :map="mapRef.map"
        />
      </Map.OlMap>
      <div class="sr-tooltip-style">
        <SrCustomTooltip id="analysisMapTooltip" ref="tooltipRef" />
      </div>
      <!-- Custom context menu for map tooltip -->
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
    <div class="sr-analysis-map-footer">
      <div>
        <Checkbox
          v-model="analysisMapStore.showTheTooltip"
          binary
          inputId="show-hide-tooltip"
          size="small"
        />
        <label for="show-hide-tooltip" class="sr-check-label">Tooltip</label>
      </div>
      <div
        v-show="computedMission === 'ICESat-2'"
        @mouseover="
          analysisMapStore.tooltipRef.showTooltip(
            $event,
            offFilterTooltip,
            recTreeStore.selectedReqIdStr
          )
        "
        @mouseleave="analysisMapStore.tooltipRef.hideTooltip()"
      >
        <Checkbox
          v-show="hasOffPointFilter"
          v-model="globalChartStore.use_y_atc_filter"
          binary
          inputId="enable-off-filter"
          size="small"
          @update:model-value="handleOffPntEnable"
          :disabled="atlChartFilterStore.showPhotonCloud"
        />
        <label v-show="hasOffPointFilter" for="enable-off-filter" class="sr-check-label"
          >Off Pointing Filter
        </label>
      </div>
      <div
        @mouseover="
          analysisMapStore.tooltipRef.showTooltip(
            $event,
            'Use full data range for map legend instead of filtered percentile range',
            recTreeStore.selectedReqIdStr
          )
        "
        @mouseleave="analysisMapStore.tooltipRef.hideTooltip"
      >
        <Checkbox
          v-model="globalChartStore.useMapLegendFullRange"
          :binary="true"
          inputId="use-full-range"
          size="small"
          @update:model-value="handleUseFullRangeUpdate"
          :title="
            globalChartStore.useMapLegendFullRange
              ? 'Using full data range (min/max)'
              : 'Using filtered percentile range (low/high)'
          "
        />
        <label for="use-full-range" class="sr-check-label">Full Range Legend </label>
      </div>
      <div
        @mouseover="
          analysisMapStore.tooltipRef.showTooltip(
            $event,
            'Enable Link to Elevation Plot to be able to location points from the plot on the map',
            recTreeStore.selectedReqIdStr
          )
        "
        @mouseleave="analysisMapStore.tooltipRef.hideTooltip"
      >
        <Checkbox
          v-show="hasLinkToElevationPlot"
          v-model="globalChartStore.enableLocationFinder"
          binary
          inputId="enable-location-finder"
          size="small"
        />
        <label v-show="hasLinkToElevationPlot" for="enable-location-finder" class="sr-check-label"
          >Link to Plot
        </label>
      </div>
      <div>
        <div class="sr-spinner">
          <ProgressSpinner
            v-if="elevationIsLoading"
            class="sr-spinner"
            animationDuration=".75s"
            style="width: 2rem; height: 2rem"
            strokeWidth="8"
            fill="var(--p-primary-300)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.sr-analysis-map-panel) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
  border-radius: 1rem;
  margin: 1rem;
  flex: 1 1 auto; /* grow, shrink, basis - let it stretch*/
}
.sr-analysis-map-header {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  height: 2rem;
  background: rgba(0, 0, 0, 0.25);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
  font-size: 1rem;
  font-weight: bold;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}
.sr-analysis-map-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;
  position: relative; /* Needed for absolute positioning of spinner */
  width: 100%;
  height: 2rem;
  background: rgba(0, 0, 0, 0.25);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
  font-size: 1rem;
  font-weight: bold;
  padding: 0.5rem;
}

/* Absolutely position the spinner on the right */
.sr-analysis-map-footer .sr-spinner {
  position: absolute;
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);
}

.sr-show-hide-tooltip {
  height: 0.5rem;
  margin: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.sr-map-container) {
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  margin-top: 0;
  padding: 0.5rem;
  display: flex;
  flex: 1 1 auto; /* let it stretch in a flex layout */
  width: 100%;
  height: 100%;
  overflow: hidden; /* if you still want curved corners to clip the child */
}

:deep(.sr-record-selector-control) {
  margin-top: 0.25rem;
  margin-left: 0.35rem;
}

:deep(.sr-ol-analysis-map) {
  min-width: 15rem;
  min-height: 15rem;
  border-radius: var(--p-border-radius);
  width: 45vw;
  height: 45vh;
  overflow: hidden;
  resize: both;
}

.sr-tooltip-style {
  position: absolute;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 0.3rem;
  border-radius: var(--p-border-radius);
  pointer-events: none;
  font-size: 1rem;
  max-width: 20rem;
}

.sr-analysis-max-pnts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 0.5rem;
  min-height: 30%;
  max-height: 30%;
  min-width: 30vw;
  width: 100%;
}

.sr-check-label {
  font-size: small;
  color: var(--p-primary-color);
  margin: 0.5rem;
}

:deep(.ol-mouse-position) {
  top: 0.5rem; /* Position from the top */
  left: 50%; /* Center align horizontally */
  right: auto; /* Reset right positioning */
  bottom: auto; /* Unset bottom positioning */
  transform: translateX(-50%); /* Adjust for the element's width */
  color: black;
  background: color-mix(in srgb, var(--p-primary-color) 25%, transparent);
  border-radius: var(--p-border-radius);
  font-size: smaller;
  padding: 0.25rem 0.5rem;
  width: fit-content; /* Only as wide as content needs */
  white-space: nowrap; /* Prevent text wrapping */
}

:deep(.sr-legend-control) {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  bottom: 0.25rem;
  right: 10rem;
}

:deep(.sr-col-menu-sel-control) {
  top: auto;
  bottom: 0.25rem;
  right: 3.5rem;
  border-radius: var(--p-border-radius);
}

:deep(.sr-col-menu-sel-control .sr-select-menu-default) {
  font-size: smaller;
  width: 5rem;
  margin: 0.0625rem;
  padding: 0.0625rem;
  height: 1.5rem;
  color: black;
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.sr-menu-input-wrapper) {
  margin: 0rem;
  padding: 0rem;
}

:deep(.sr-select-menu-item) {
  margin: 0rem;
  padding: 0rem;
}

:deep(.sr-progress-spinner-control) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 1rem;
  border-radius: 50%;
  z-index: 9999;
  pointer-events: none; /* Prevent interaction issues */
}
.sr-isLoadingEl {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #e9df1c;
  padding-top: 0.5rem;
  margin-bottom: 0rem;
  padding-bottom: 0;
  font-size: 1rem;
  align-items: center;
}
.sr-notLoadingEl {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #4caf50;
  padding-top: 0.5rem;
  margin-bottom: 0rem;
  padding-bottom: 0;
  font-size: 1rem;
  align-items: center;
}
.hidden-control {
  display: none;
}

:deep(.ol-zoom) {
  top: 2rem;
  right: 0.5rem; /* right align -- match layer switcher and attribution */
  left: auto; /* Override the default positioning */
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  margin: auto;
  font-size: 0.75rem;
  z-index: 99999; /* Ensure it stays on top */
}

:deep(.ol-zoom button) {
  width: 1.5rem; /* Smaller button size */
  height: 1.5rem;
  color: black;
  background: transparent;
}

:deep(.ol-zoom .ol-zoom-in),
:deep(.ol-zoom .ol-zoom-out) {
  position: relative;
  margin: 1px;
  border-radius: var(--p-border-radius);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  color: black;
  font-size: 1rem;
  font-weight: 500;
}

:deep(.ol-zoom .ol-zoom-out):active,
:deep(.ol-zoom .ol-zoom-in):active {
  background: color-mix(in srgb, var(--p-primary-color) 50%, transparent);
  transform: translateY(1px); /* Slight downward movement to simulate press */
}

:deep(.ol-zoom .ol-zoom-out):hover,
:deep(.ol-zoom .ol-zoom-in):hover {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-zoom .ol-zoom-out):before {
  content: '';
  position: absolute;
  top: 0px;
  left: 25%; /* Adjust this value to control where the border starts */
  right: 25%; /* Adjust this value to control where the border ends */
  border-top: 1px dashed black;
}

:deep(.ol-control.sr-baselayer-control) {
  top: 0.25rem;
  bottom: auto;
  right: 0.5rem;
  left: auto;
  border-radius: var(--p-border-radius);
  max-width: 30rem;
  background: transparent;
}

:deep(.ol-control.sr-graticule-control) {
  top: auto;
  bottom: 0.25rem;
  right: 23rem;
  left: auto;
  margin: 0;
  border-radius: var(--p-border-radius);
}

/* ScaleLine control positioning - styling is in sr-common-styles.css */
:deep(.ol-scale-line) {
  bottom: 0.25rem;
  left: 0.5rem;
}

/* Ensure OL controls container is above Deck.gl canvas (which has z-index: 1) */
:deep(.ol-overlaycontainer-stopevent) {
  z-index: 10 !important;
}

/* Layer Switcher Control */
:deep(.ol-control.ol-layerswitcher) {
  top: 6.5rem;
  bottom: auto;
  left: auto;
  right: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  z-index: 10000; /* Above Deck.gl overlay */
}

:deep(.ol-control.ol-layerswitcher:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-control.ol-layerswitcher > button) {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-radius: var(--p-border-radius);
  display: grid;
  place-items: center;
  line-height: 1;
  font-size: 1rem;
  color: black;
}

:deep(.ol-control.ol-layerswitcher > button:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.ol-control.ol-layerswitcher .panel-container) {
  width: 18rem;
  max-width: 90vw;
  background-color: var(--p-primary-100);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

:deep(.ol-control.ol-layerswitcher .panel) {
  max-height: 40vh;
  overflow: auto;
}

:deep(.ol-layerswitcher label) {
  background-color: transparent;
  color: var(--p-primary-color);
  font-weight: bold;
  font-family: var(--p-font-family);
  border-radius: var(--p-border-radius);
}

:deep(.ol-layerswitcher .panel .li-content) {
  padding: 0.25rem 0.5rem;
}

:deep(.ol-layerswitcher .panel .li-content > label) {
  font-size: 0.85rem;
}

/* Graticule styling - ensure labels aren't clipped */
:deep(.ol-layer canvas) {
  /* Allow graticule labels to overflow without being clipped */
  overflow: visible !important;
}

/* Temporarily disabled - may interfere with base layer tile rendering
.overlays canvas {
  mix-blend-mode: multiply;
}
*/

:deep(.sr-select-menu-default, .sr-select-menu-default-insensitive) {
  width: 100%;
  padding: 0.125rem 0.125rem 0.125rem 0.125rem; /* Top Right Bottom Left */
  color: white;
  background-color: #2c2c2c;
  border: 2px solid #3a3a3a;
  border-radius: 0.5rem;
  font-family: var(--p-font-family);
  font-size: small;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease;
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
