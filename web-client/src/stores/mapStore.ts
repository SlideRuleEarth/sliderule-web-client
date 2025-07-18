import { defineStore } from 'pinia';
import { Map as OLMap } from 'ol';
import TileLayer from 'ol/layer/Tile.js';
import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import ol_control_WMTSCapabilities from 'ol-ext/control/WMTSCapabilities';
import { usePermalink } from '@/composables/usePermalink';
import { Graticule } from 'ol';
import { Stroke } from 'ol/style';
import { type Coordinate } from "ol/coordinate";
import type { EventsKey } from 'ol/events';
import {type Type as OlGeometryType} from 'ol/geom/Geometry';
import { srViews } from '@/composables/SrViews';
import type { SrView } from '@/composables/SrViews';
import { findSrView } from '@/composables/SrViews';
import type { SrLayer } from '@/composables/SrLayers.js';
import { ref, type Ref } from 'vue';


interface LayerCache {
  [projectionName: string]: Map<string, TileLayer>;
}

export type TimeoutHandle = ReturnType<typeof setTimeout>;

export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as OLMap | null,
    wmsCapCache: new Map(), // a javascript Map object
    currentWmsCapProjectionName: 'EPSG:3857' as string,
    wmtsCapCache: new Map(), // a javascript Map object
    currentWmtsCapProjectionName: 'EPSG:3857' as string,
    plink: usePermalink(),
    graticuleState: false,
    graticule : new Graticule({
        // Style options go here
        strokeStyle: new Stroke({
            color: 'rgba(255,120,0,0.9)',
            width: 2,
            lineDash: [0.5, 4]
        }),
        showLabels: true,
        wrapX: false
    }),
    polygonSource:'Draw on Map' as string,
    polygonSourceItems: ['Draw on Map','GeoJSON File', 'Shapefile'] as string[],
    polyCoords: <Coordinate[][]>([]),
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
}),
  actions: {
    setMap(mapInstance: OLMap) {
      this.map = mapInstance;
    },
    getMap() {
      return this.map;
    },
    setCurrentWmsCap(projectionName: string) {
      const wmsCap = this.getWmsCapFromCache(projectionName);
      this.map?.addControl(wmsCap);
      this.currentWmsCapProjectionName = projectionName;
    },
    // WMS Capabilities
    getWmsCapFromCache(projectionName:string) : ol_control_WMSCapabilities {
      return this.wmsCapCache.get(projectionName);
    },
    cacheWmsCapForProjection(projectionName:string, wmsCapInstance: ol_control_WMSCapabilities) {
      //console.log('cacheWmsCapForProjection:', projectionName);
      this.wmsCapCache.set(projectionName, wmsCapInstance);
    },
    updateWmsCap(projectionName: string)  {
      console.log('updateWmsCap:', projectionName);
      const currentWmsCapCntrl = this.getWmsCapFromCache(this.currentWmsCapProjectionName );
      if(currentWmsCapCntrl){
        this.map?.removeControl(currentWmsCapCntrl);
      } else {
        console.log(`currentWmsCapCntrl for '${this.currentWmsCapProjectionName}' not found in cache`);
      }
      this.setCurrentWmsCap(projectionName);
    },
    // WMTS Capabilities
    setCurrentWmtsCap(projectionName: string) {
      const wmtsCap = this.getWmtsCapFromCache(projectionName);
      console.log('setCurrentWmtsCap:', projectionName, wmtsCap);
      if(this.map){
        console.log('adding wmtsCap to map:', wmtsCap);
        this.map?.addControl(wmtsCap);
        this.currentWmtsCapProjectionName = projectionName;
      }
    },
    getWmtsCapFromCache(projectionName:string) : ol_control_WMTSCapabilities {
      return this.wmtsCapCache.get(projectionName);
    },
    cacheWmtsCapForProjection(projectionName:string, wmtsCapInstance: ol_control_WMTSCapabilities) {
      console.log('cacheWmtsCapForProjection:', projectionName);
      this.wmtsCapCache.set(projectionName, wmtsCapInstance);
    },
    updateWmtsCap(projectionName: string)  {
      console.log('updateWmtsCap:', projectionName);
      const currentWmtsCapCntrl = this.getWmtsCapFromCache(this.currentWmtsCapProjectionName );
      if(currentWmtsCapCntrl){
        this.map?.removeControl(currentWmtsCapCntrl);
      } else {
        console.log(`currentWmtsCapCntrl for '${this.currentWmtsCapProjectionName}' not found in cache`);
      }
      this.setCurrentWmtsCap(projectionName);
    },
    toggleGraticule() {
      this.graticuleState = !this.graticuleState;
      this.setGraticuleForMap();
    },
    getGraticuleState() {
      return this.graticuleState;
    },
    setGraticuleState(state: boolean) {
      this.graticuleState = state;
      this.setGraticuleForMap();
    },
    setGraticuleForMap() {
      if (this.graticuleState) {
        const thisMap = this.map as OLMap;
        if(thisMap){
          this.graticule.setMap(thisMap);
        }
      } else {
          this.graticule.setMap(null);
      }
    },
    // addDeckLayer(layer:OL_Layer_Type<Source, LayerRenderer<any>>) {
    //   this.dLayers.push(layer as OL_Layer_Type<Source, LayerRenderer<any>>);
    // },
    // getDeckLayers():  OL_Layer_Type<Source, LayerRenderer<any>>[]{
    //   return this.dLayers as OL_Layer_Type<Source, LayerRenderer<any>>[];
    // },
    getCurrentReqId() {
      return this.currentReqId;
    },
    setCurrentReqId(reqId: number) {
      this.currentReqId = reqId;
    },
    setRedrawElevationsTimeoutHandle(handle: TimeoutHandle) {
      this.reDrawElevationsTimeoutHandle = handle;
    },
    clearRedrawElevationsTimeoutHandle() {
      if (this.reDrawElevationsTimeoutHandle) {
        clearTimeout(this.reDrawElevationsTimeoutHandle);
        this.reDrawElevationsTimeoutHandle = null;
      }
    },
    getRedrawElevationsTimeoutHandle() {
      return this.reDrawElevationsTimeoutHandle;
    },
    getPolySource() {
      return this.polygonSource;
    },
    setPolySource(source: string) {
      this.polygonSource = source;
    },
    getPointerMoveListenerKey() {
      return this.pointerMoveListenerKey;
    },
    setPointerMoveListenerKey(key: EventsKey|null) {
      this.pointerMoveListenerKey = key;
    },
    addLayerToCache(projectionName: string, title: string, layer: TileLayer): void {
      if (!this.layerCache[projectionName]) {
          this.layerCache[projectionName] = new Map<string, TileLayer>();
      }
      this.layerCache[projectionName].set(title, layer);
    },
    getLayerFromCache(projectionName: string, title: string): TileLayer | null {
        const projectionLayers = this.layerCache[projectionName];
        return projectionLayers ? projectionLayers.get(title) || null : null;
    },
    removeLayerFromCache(projectionName: string, title: string): void {
        const projectionLayers = this.layerCache[projectionName];
        if (projectionLayers) {
        projectionLayers.delete(title);
        // Optionally, clean up empty projection maps
        if (projectionLayers.size === 0) {
            delete this.layerCache[projectionName];
        }
        }
    },
    resetMap() {
        this.selectedView = 'Global Mercator' as string;
        this.drawType = '' as string;
        this.layerCache = {} as LayerCache;
    },
    setSrView(srView: string) {
        this.selectedView = srView;
        const srViewObj = srViews.value[srView] as SrView;
    },
    getSrView() {
        return this.selectedView;
    },
    getSrViewObj() : SrView {
        return findSrView(this.selectedView,this.selectedBaseLayer).value as SrView;
    },
    getDrawType(): string {
        return this.drawType;
    },
    getDrawTypeAsGeometryType(): OlGeometryType {
        return this.drawType as OlGeometryType;
    },
    setDrawType(drawType: string) {
        this.drawType = drawType;
    }, 
    setSelectedBaseLayer(baseLayer: string) {
        this.selectedBaseLayer = baseLayer;
        //console.trace('setSelectedBaseLayer:', baseLayer);
    },
    getSelectedBaseLayer() {
      console.log('getSelectedBaseLayer:', this.selectedBaseLayer);
      return this.selectedBaseLayer;
    },
    setSelectedView(view: string) {
        this.selectedView = view;
    },
    getSelectedView() {
        return this.selectedView;
    },
    getUniqueBaseLayersForView(view: string): string[] {
        const baseLayerSet = new Set<string>(
          Object.values(srViews.value)
            .filter((srView) => srView.view === view)
            .map((srView) => srView.baseLayerName)
        );
        return Array.from(baseLayerSet);
    },
    getExtentToRestore(): number[] | null {
        return this.extentToRestore;
    },
    setExtentToRestore(extent: number[]) {
        this.extentToRestore = extent;
    },
    getCenterToRestore() {
        return this.centerToRestore;
    },
    setCenterToRestore(center: number[]) {
      console.log('setCenterToRestore:', center);
      if (center) {
        this.centerToRestore = center;
      } else {
        console.warn('setCenterToRestore: center was null?');
      }
    },
    getZoomToRestore() {
        return this.zoomToRestore;
    },
    setZoomToRestore(zoom: number) {
        this.zoomToRestore = zoom;
    },
    setDropPinEnabled(enabled: boolean) {
      this.dropPinEnabled = enabled;
    },
    isDropPinEnabled() {
      return this.dropPinEnabled;
    },
    getMinZoomToShowPin() {
      return this.minZoomToShowPin;
    },
    setMinZoomToShowPin(minZoom: number) {
      this.minZoomToShowPin = minZoom;
    }
  },
});
