import { defineStore } from 'pinia'
import type OLMap from 'ol/Map.js'
import TileLayer from 'ol/layer/Tile.js'
import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities'
import ol_control_WMTSCapabilities from 'ol-ext/control/WMTSCapabilities'
import { usePermalink } from '@/composables/usePermalink'
import Graticule from 'ol/layer/Graticule.js'
import { Stroke, Fill, Text } from 'ol/style'
import { type Coordinate } from 'ol/coordinate'
import type { EventsKey } from 'ol/events'
import { type Type as OlGeometryType } from 'ol/geom/Geometry'
import { srViews } from '@/composables/SrViews'
import type { SrView } from '@/composables/SrViews'
import { findSrView } from '@/composables/SrViews'
import type { SrLayer } from '@/composables/SrLayers.js'
import { ref, type Ref } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('MapStore')

interface LayerCache {
  [projectionName: string]: Map<string, TileLayer>
}

// Factory function to create graticule instances
// Each map needs its own graticule instance
function createGraticuleLayer(): Graticule {
  return new Graticule({
    strokeStyle: new Stroke({
      color: 'rgba(255,120,0,0.9)', // Orange like OpenLayers example
      width: 2,
      lineDash: [0.5, 4]
    }),
    showLabels: true,
    visible: false, // Start hidden, control via setVisible()
    wrapX: false, // Prevent dateline wrapping issues during projection changes
    lonLabelPosition: 0.1,
    latLabelPosition: 0.9,
    latLabelStyle: new Text({
      font: 'bold 12px Calibri,sans-serif',
      textAlign: 'end',
      fill: new Fill({
        color: 'rgba(255,255,255,1)'
      }),
      stroke: new Stroke({
        color: 'rgba(0,0,0,0.9)',
        width: 3
      })
    }),
    lonLabelStyle: new Text({
      font: 'bold 12px Calibri,sans-serif',
      textBaseline: 'top',
      fill: new Fill({
        color: 'rgba(255,255,255,1)'
      }),
      stroke: new Stroke({
        color: 'rgba(0,0,0,0.9)',
        width: 3
      })
    })
  })
}

export type TimeoutHandle = ReturnType<typeof setTimeout>

export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as OLMap | null,
    wmsCapCache: new Map(), // a javascript Map object
    currentWmsCapProjectionName: 'EPSG:3857' as string,
    wmtsCapCache: new Map(), // a javascript Map object
    currentWmtsCapProjectionName: 'EPSG:3857' as string,
    plink: usePermalink(),
    // Restore graticule state from localStorage, default to false
    graticuleState: localStorage.getItem('graticuleState') === 'true',
    // Store graticule instances per map (request map and analysis map need separate instances)
    graticules: new Map<OLMap, Graticule>(),
    polygonSource: 'Draw on Map' as string,
    polygonSourceItems: ['GeoJSON File', 'Shapefile'] as string[], // Possible polygon sources for upload
    polyCoords: <Coordinate[][]>[],
    currentReqId: 0 as number,
    reDrawElevationsTimeoutHandle: null as TimeoutHandle | null, // Handle for the timeout to clear it when necessary
    pointerMoveListenerKey: null as EventsKey | null,
    selectedView: 'Global Mercator' as string,
    selectedBaseLayer: 'Esri World Topo' as string,
    drawType: '' as string,
    layerCache: {} as LayerCache, // A dictionary of projection names to maps of layers
    layerGroupCache: new Map<string, Map<string, SrLayer>>(), // If you need a similar structure for groups
    extentToRestore: null as number[] | null,
    centerToRestore: null as number[] | null,
    zoomToRestore: null as number | null,
    tooltipRef: ref(null) as Ref<InstanceType<any> | null>,
    dropPinEnabled: false as boolean,
    minZoomToShowPin: 5 as number, // Minimum zoom level to show the pin
    viewListenerCleanup: null as null | (() => void)
  }),
  actions: {
    setMap(mapInstance: OLMap) {
      this.map = mapInstance
    },
    setViewListenerCleanup(cleanup: null | (() => void)) {
      this.viewListenerCleanup = cleanup
    },
    runViewListenerCleanup() {
      if (this.viewListenerCleanup) {
        this.viewListenerCleanup()
        this.viewListenerCleanup = null
      }
    },
    getMap() {
      return this.map
    },
    setCurrentWmsCap(projectionName: string) {
      const wmsCap = this.getWmsCapFromCache(projectionName)
      this.map?.addControl(wmsCap)
      this.currentWmsCapProjectionName = projectionName
    },
    // WMS Capabilities
    getWmsCapFromCache(projectionName: string): ol_control_WMSCapabilities {
      return this.wmsCapCache.get(projectionName)
    },
    cacheWmsCapForProjection(projectionName: string, wmsCapInstance: ol_control_WMSCapabilities) {
      //console.log('cacheWmsCapForProjection:', projectionName);
      this.wmsCapCache.set(projectionName, wmsCapInstance)
    },
    updateWmsCap(projectionName: string) {
      logger.debug('updateWmsCap', { projectionName })
      const currentWmsCapCntrl = this.getWmsCapFromCache(this.currentWmsCapProjectionName)
      if (currentWmsCapCntrl) {
        this.map?.removeControl(currentWmsCapCntrl)
      } else {
        logger.debug('currentWmsCapCntrl not found in cache', {
          projectionName: this.currentWmsCapProjectionName
        })
      }
      this.setCurrentWmsCap(projectionName)
    },
    // WMTS Capabilities
    setCurrentWmtsCap(projectionName: string) {
      const wmtsCap = this.getWmtsCapFromCache(projectionName)
      logger.debug('setCurrentWmtsCap', { projectionName, wmtsCap })
      if (this.map) {
        logger.debug('adding wmtsCap to map', { wmtsCap })
        this.map?.addControl(wmtsCap)
        this.currentWmtsCapProjectionName = projectionName
      }
    },
    getWmtsCapFromCache(projectionName: string): ol_control_WMTSCapabilities {
      return this.wmtsCapCache.get(projectionName)
    },
    cacheWmtsCapForProjection(
      projectionName: string,
      wmtsCapInstance: ol_control_WMTSCapabilities
    ) {
      logger.debug('cacheWmtsCapForProjection', { projectionName })
      this.wmtsCapCache.set(projectionName, wmtsCapInstance)
    },
    updateWmtsCap(projectionName: string) {
      logger.debug('updateWmtsCap', { projectionName })
      const currentWmtsCapCntrl = this.getWmtsCapFromCache(this.currentWmtsCapProjectionName)
      if (currentWmtsCapCntrl) {
        this.map?.removeControl(currentWmtsCapCntrl)
      } else {
        logger.debug('currentWmtsCapCntrl not found in cache', {
          projectionName: this.currentWmtsCapProjectionName
        })
      }
      this.setCurrentWmtsCap(projectionName)
    },
    toggleGraticule() {
      this.graticuleState = !this.graticuleState
      this.setGraticuleForMap()
    },
    getGraticuleState() {
      return this.graticuleState
    },
    setGraticuleState(state: boolean) {
      this.graticuleState = state
      // Persist to localStorage
      localStorage.setItem('graticuleState', String(state))
      this.setGraticuleForMap()
    },
    getOrCreateGraticule(map: OLMap): Graticule {
      // Get existing graticule for this map, or create a new one
      let graticule = this.graticules.get(map)
      if (!graticule) {
        graticule = createGraticuleLayer()
        graticule.setZIndex(1000) // Ensure it renders on top
        // Set initial visibility based on current state
        graticule.setVisible(this.graticuleState)
        this.graticules.set(map, graticule)
        logger.debug('Created new graticule instance for map', {
          visible: this.graticuleState,
          zIndex: 1000
        })
      }
      return graticule as Graticule // Type assertion to fix TypeScript error
    },
    recreateGraticuleForMap(map: OLMap) {
      // Remove existing graticule if present
      const existingGraticule = this.graticules.get(map)
      if (existingGraticule) {
        map.removeLayer(existingGraticule as any)
        this.graticules.delete(map)
        logger.debug('Removed old graticule for projection change')
      }

      // Create new graticule for current projection
      const newGraticule = this.getOrCreateGraticule(map)
      map.addLayer(newGraticule)

      logger.debug('Recreated graticule for new projection', {
        projection: map.getView().getProjection().getCode(),
        visible: newGraticule.getVisible()
      })
    },
    setGraticuleForMap(targetMap?: OLMap) {
      // Update visibility for all graticule instances
      // If targetMap is provided, only update that map's graticule
      this.graticules.forEach((graticule, map) => {
        if (!targetMap || map === targetMap) {
          graticule.setVisible(this.graticuleState)
          const projectionCode = map.getView().getProjection().getCode()

          // Debug: verify layer is in map and check properties
          const allLayers = map.getAllLayers()
          const graticuleLayers = allLayers.filter((layer) => layer instanceof Graticule)
          const graticuleOpacity = graticule.getOpacity()

          logger.debug('Graticule visibility changed', {
            visible: this.graticuleState,
            projection: projectionCode,
            opacity: graticuleOpacity,
            zIndex: graticule.getZIndex(),
            graticuleLayersInMap: graticuleLayers.length,
            totalLayers: allLayers.length
          })

          // OpenLayers automatically renders when visibility changes - no manual render needed
        }
      })
    },
    // addDeckLayer(layer:OL_Layer_Type<Source, LayerRenderer<any>>) {
    //   this.dLayers.push(layer as OL_Layer_Type<Source, LayerRenderer<any>>);
    // },
    // getDeckLayers():  OL_Layer_Type<Source, LayerRenderer<any>>[]{
    //   return this.dLayers as OL_Layer_Type<Source, LayerRenderer<any>>[];
    // },
    getCurrentReqId() {
      return this.currentReqId
    },
    setCurrentReqId(reqId: number) {
      this.currentReqId = reqId
    },
    setRedrawElevationsTimeoutHandle(handle: TimeoutHandle) {
      this.reDrawElevationsTimeoutHandle = handle
    },
    clearRedrawElevationsTimeoutHandle() {
      if (this.reDrawElevationsTimeoutHandle) {
        clearTimeout(this.reDrawElevationsTimeoutHandle)
        this.reDrawElevationsTimeoutHandle = null
      }
    },
    getRedrawElevationsTimeoutHandle() {
      return this.reDrawElevationsTimeoutHandle
    },
    getPolySource() {
      return this.polygonSource
    },
    setPolySource(source: string) {
      this.polygonSource = source
    },
    getPointerMoveListenerKey() {
      return this.pointerMoveListenerKey
    },
    setPointerMoveListenerKey(key: EventsKey | null) {
      this.pointerMoveListenerKey = key
    },
    addLayerToCache(projectionName: string, title: string, layer: TileLayer): void {
      if (!this.layerCache[projectionName]) {
        this.layerCache[projectionName] = new Map<string, TileLayer>()
      }
      this.layerCache[projectionName].set(title, layer)
    },
    getLayerFromCache(projectionName: string, title: string): TileLayer | null {
      const projectionLayers = this.layerCache[projectionName]
      return projectionLayers ? projectionLayers.get(title) || null : null
    },
    removeLayerFromCache(projectionName: string, title: string): void {
      const projectionLayers = this.layerCache[projectionName]
      if (projectionLayers) {
        projectionLayers.delete(title)
        // Optionally, clean up empty projection maps
        if (projectionLayers.size === 0) {
          delete this.layerCache[projectionName]
        }
      }
    },
    resetMap() {
      this.selectedView = 'Global Mercator' as string
      this.drawType = '' as string
      this.layerCache = {} as LayerCache
    },
    setSrView(srView: string) {
      this.selectedView = srView
      // Note: srViewObj is intentionally not used - it's here for potential future use
      // const srViewObj = srViews.value[srView] as SrView;
    },
    getSrView() {
      return this.selectedView
    },
    getSrViewObj(): SrView {
      return findSrView(this.selectedView, this.selectedBaseLayer).value as SrView
    },
    getDrawType(): string {
      return this.drawType
    },
    getDrawTypeAsGeometryType(): OlGeometryType {
      return this.drawType as OlGeometryType
    },
    setDrawType(drawType: string) {
      this.drawType = drawType
    },
    setSelectedBaseLayer(baseLayer: string) {
      this.selectedBaseLayer = baseLayer
      //console.trace('setSelectedBaseLayer:', baseLayer);
    },
    getSelectedBaseLayer() {
      logger.debug('getSelectedBaseLayer', { selectedBaseLayer: this.selectedBaseLayer })
      return this.selectedBaseLayer
    },
    setSelectedView(view: string) {
      this.selectedView = view
    },
    getSelectedView() {
      return this.selectedView
    },
    getUniqueBaseLayersForView(view: string): string[] {
      const baseLayerSet = new Set<string>(
        Object.values(srViews.value)
          .filter((srView) => srView.view === view)
          .map((srView) => srView.baseLayerName)
      )
      return Array.from(baseLayerSet)
    },
    getExtentToRestore(): number[] | null {
      return this.extentToRestore
    },
    setExtentToRestore(extent: number[]) {
      this.extentToRestore = extent
    },
    getCenterToRestore() {
      return this.centerToRestore
    },
    setCenterToRestore(center: number[]) {
      logger.debug('setCenterToRestore', { center })
      if (center) {
        this.centerToRestore = center
      } else {
        logger.warn('setCenterToRestore: center was null')
      }
    },
    getZoomToRestore() {
      return this.zoomToRestore
    },
    setZoomToRestore(zoom: number) {
      this.zoomToRestore = zoom
    },
    setDropPinEnabled(enabled: boolean) {
      this.dropPinEnabled = enabled
    },
    isDropPinEnabled() {
      return this.dropPinEnabled
    },
    getMinZoomToShowPin() {
      return this.minZoomToShowPin
    },
    setMinZoomToShowPin(minZoom: number) {
      this.minZoomToShowPin = minZoom
    }
  }
})
