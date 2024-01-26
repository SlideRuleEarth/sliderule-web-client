import { defineStore } from 'pinia';
import { ref } from 'vue';
import { OSM, XYZ } from 'ol/source';
import TileLayer from 'ol/layer/Tile.js';
type AnyTileLayer = TileLayer<OSM> | TileLayer<XYZ>;
interface BaseLayer {
  title: string;
  url: string;
}
export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: [-108, 39],
    projection: "EPSG:4326",
    zoom: 12,
    rotation: 0,
    baseLayer: { 
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", 
      title: "World Topo Map" 
    } as BaseLayer,
    drawEnabled: false,
    drawType: 'undefined',
    layerList: <AnyTileLayer[]>([])
  }),
  actions:{
    resetMap() {
      this.center = [-108, 39];
      this.projection = 'EPSG:4326';
      this.zoom = 12;
      this.rotation = 0;
      this.baseLayer= {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        title: "World Topo Map"
      }
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
    setBaseLayer(layer: BaseLayer) {
      this.baseLayer = layer;
    }
  },
});
