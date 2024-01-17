import { defineStore } from 'pinia';
import { ref } from 'vue';
import { OSM, XYZ } from 'ol/source';
import TileLayer from 'ol/layer/Tile.js';
type AnyTileLayer = TileLayer<OSM> | TileLayer<XYZ>;

export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: ref([-108, 39]),
    projection: ref("EPSG:4326"),
    zoom: ref(12),
    rotation: ref(0),
    baseLayer: ref({ 
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", 
      title: "World Topo Map" 
    }),
    drawEnabled: ref(false),
    drawType: ref('undefined'),
    layerList: ref<AnyTileLayer[]>([])
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
    setBaseLayer(url: string, title: string) {
      this.baseLayer.url = url;
      this.baseLayer.title = title;
      console.log('setBaseLayer', this.baseLayer);
    }
  },
});
