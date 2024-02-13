import { defineStore } from 'pinia';
import {  getDefaultBaseLayer} from '@/composables/SrLayers.js';
import type { SrProjection } from '@/composables/SrProjections';
import type { SrLayer } from '@/composables/SrLayers.js';
import { projections } from '@/composables/SrProjections';
import Collection from 'ol/Collection.js';
import BaseLayer from 'ol/layer/Base.js';
import { getDefaultProjection } from '@/composables/SrProjections.js';

type SrLayers = Collection<BaseLayer> | BaseLayer[];


export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: [0, 0],
    extent: [0, 0, 0, 0],
    projection: projections.value[0] as SrProjection,
    zoom: 12,
    rotation: 0,
    selectedBaseLayer: getDefaultBaseLayer(getDefaultProjection().name) as SrLayer,
    drawEnabled: false,
    drawType: 'undefined',
    layerCache: new Map(), // Note this is a javascript Map, not an OpenLayers Map
    layerGroupCache: new Map(), // Note this is a javascript Map, not an OpenLayers Map
  }),
  actions:{
    cacheLayer(title:string, layerInstance:any) {
      this.layerCache.set(title, layerInstance);
    },
    getLayerFromCache(title:string) : any {
      return this.layerCache.get(title);
    },
    resetMap() {
      this.projection = projections.value[0] as SrProjection;
      this.center = projections.value[0].default_center;
      this.extent = projections.value[0].bbox || [0, 0, 0, 0];
      this.zoom = 12;
      this.rotation = 0;
      this.selectedBaseLayer=getDefaultBaseLayer(getDefaultProjection().name) as SrLayer,
      this.drawEnabled = false;
      this.drawType = 'undefined';
      this.layerCache = new Map(), // Note this is a javascript Map, not an OpenLayers Map
      this.layerGroupCache =new Map() // Note this is a javascript Map, not an OpenLayers Map
    },
    setCenter(c:number[]) {
      this.center = c;
    },
    setRotation(r:number) {
      this.rotation = r;
    },
    setZoom(z:number) {
      this.zoom = z;
    },
    setSelectedBaseLayer(layer: SrLayer) {
      this.selectedBaseLayer = layer;
    },
    setProjection(proj: SrProjection) {
      //console.log('setProjection', proj);
      this.projection = proj;
    },
    setExtent(ext: number[]) {
      this.extent = ext;
    },
    getZoom() {
      return this.zoom;
    },
    getCenter() { 
      return this.center;
    },
    getRotation() {
      return this.rotation;
    },
    getSelectedBaseLayer() {
      return this.selectedBaseLayer;
    },
    getProjection() {
      return this.projection;
    },
    getExtent() {
      return this.extent;
    },
    getDrawEnabled() {
      return this.drawEnabled;
    }  
  },
});
