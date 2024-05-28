import { defineStore } from 'pinia';
import { Map as OLMap } from 'ol';
import ol_control_WMSCapabilities from 'ol-ext/control/WMSCapabilities';
import ol_control_WMTSCapabilities from 'ol-ext/control/WMTSCapabilities';
import { usePermalink } from '@/composables/usePermalink';
import { Graticule } from 'ol';
import { Stroke } from 'ol/style';
import { type Coordinate } from "ol/coordinate";
import { Layer as OL_Layer} from 'ol/layer';
import { Deck } from '@deck.gl/core/typed';
//import { fetchAndUpdateElevationData } from '@/utils/SrMapUtils';

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
            width: 1,
            lineDash: [0.5, 4]
        }),
        showLabels: true,
        wrapX: false
    }),
    polygonSource:{name:'Draw on Map',value:'Draw on Map'},
    polyCoords: <Coordinate[][]>([]),
    deckInstance: null as any,
    theDeckLayer: null as OL_Layer | null,
    isLoading: false,
    isAborting: false,
    currentReqId: 0 as number,
    redrawTimeOutSeconds: 5,
    reDrawElevationsTimeoutHandle: null as TimeoutHandle | null // Handle for the timeout to clear it when necessary
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
        if (this.graticuleState) {
          const thisMap = this.map as OLMap;
          if(thisMap){
            this.graticule.setMap(thisMap);
          }
        } else {
            this.graticule.setMap(null);
        }
    },
    setDeckInstance(instance:Deck) {
      this.deckInstance = instance;
    },
    getDeckInstance() {
      return this.deckInstance;
    },
    clearDeckInstance() {
      if (this.deckInstance) {
          console.log('clearDeckInstance');
          this.deckInstance.finalize(); // This ensures all resources are properly released.
          this.deckInstance = null;
      } else {
          console.log('deckInstance is null');
      }
    },
      setDeckLayer(layer:OL_Layer) {
      this.theDeckLayer = layer;
    },
    getDeckLayer() : OL_Layer | null {
      return this.theDeckLayer as OL_Layer | null;
    }, 
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
    // async drawElevations() {
    //   if (this.isLoading && !this.isAborting) {
    //       await fetchAndUpdateElevationData(this.getCurrentReqId());
    //   } else {
    //       console.log('drawElevations: SKIPPED - not loading or aborting');
    //   }
    // },
    // scheduleDrawElevations() {
    //   this.clearRedrawElevationsTimeoutHandle();
    //   this.setRedrawElevationsTimeoutHandle(setTimeout(this.drawElevations, this.redrawTimeOutSeconds * 1000));
    //   console.log('Scheduled Redraw elevations in ', this.redrawTimeOutSeconds, 'seconds');
    // }

  },
});
