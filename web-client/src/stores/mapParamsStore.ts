import { defineStore } from 'pinia';
import { OSM, XYZ } from 'ol/source';
import { Map } from 'ol';
import TileLayer from 'ol/layer/Tile.js';
import type { SrBaseLayer } from '@/composables/SrBaseLayers.js';
import { baseLayers } from '@/composables/SrBaseLayers.js';
type AnyTileLayer = TileLayer<OSM> | TileLayer<XYZ>;


export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    map: null as Map | null,
    center: [-108, 39],
    projection: "EPSG:4326",
    zoom: 12,
    rotation: 0,
    baseLayer: baseLayers.value[0] as SrBaseLayer,
    drawEnabled: false,
    drawType: 'undefined',
    layerList: <AnyTileLayer[]>([])
  }),
  actions:{
    setMap(newMap: Map) {
      this.map = newMap;
    },
    resetMap() {
      this.center = [-108, 39];
      this.projection = 'EPSG:4326';
      this.zoom = 12;
      this.rotation = 0;
      this.baseLayer=baseLayers.value[0] as SrBaseLayer,
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
    }
  },
});
