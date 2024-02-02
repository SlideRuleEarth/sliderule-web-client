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
    center: [-108, 39],
    projection: projections.value[0] as SrProjection,
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
      this.center = projections.value[0].default_center;
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
      this.center = proj.default_center;
      //console.log('proj.default_zoom:', proj.default_zoom);
      this.zoom = proj.default_zoom || 12;
      //console.log('this.zoom:', this.zoom);
    },
    getZoom() {
      return this.zoom;
    }
  },
});
