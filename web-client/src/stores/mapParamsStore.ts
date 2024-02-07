import { defineStore } from 'pinia';
import { OSM, XYZ } from 'ol/source';
import { Map } from 'ol';
import TileLayer from 'ol/layer/Tile.js';
import type { SrBaseLayer } from '@/composables/SrBaseLayers.js';
import { baseLayers } from '@/composables/SrBaseLayers.js';
import type { SrProjection } from '@/composables/SrProjections';
import { projections } from '@/composables/SrProjections';

type AnyTileLayer = TileLayer<OSM> | TileLayer<XYZ>;


export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: [0, 0],
    extent: [0, 0, 0, 0],
    projection: projections.value[0] as SrProjection,
    proj_name: projections.value[0].name,
    zoom: 12,
    rotation: 0,
    baseLayer: baseLayers.value[0] as SrBaseLayer,
    tile_title: baseLayers.value[0].title,
    drawEnabled: false,
    drawType: 'undefined',
    layerList: <AnyTileLayer[]>([])
  }),
  actions:{
    resetMap() {
      this.projection = projections.value[0] as SrProjection;
      this.proj_name = projections.value[0].name;
      this.center = projections.value[0].default_center;
      this.extent = projections.value[0].bbox || [0, 0, 0, 0];
      this.zoom = 12;
      this.rotation = 0;
      this.baseLayer=baseLayers.value[0] as SrBaseLayer,
      this.tile_title = baseLayers.value[0].title,
      this.drawEnabled = false;
      this.drawType = 'undefined';
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
    addLayer(l: TileLayer<OSM> | TileLayer<XYZ>) {
      console.log('addLayer', l);
      this.layerList.push(l);
    },
    setBaseLayer(layer: SrBaseLayer) {
      this.baseLayer = layer;
      this.tile_title = layer.title;
    },
    setProjection(proj: SrProjection) {
      this.projection = proj;
    },
    setProjName(name: string) {
      this.proj_name = name;
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
    getBaseLayer() {
      return this.baseLayer;
    },
    getProjection() {
      return this.projection;
    },
    getProjName() {
      return this.proj_name;
    },
    getExtent() {
      return this.extent;
    },
    getDrawEnabled() {
      return this.drawEnabled;
    }  
  },
});
