import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: ref([-108, 39]),
    projection: ref("EPSG:4326"),
    zoom: ref(12),
    rotation: ref(0),
    selectedLayer: ref("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"),
    drawEnabled: ref(false),
    drawType: ref('Polygon'),
  }),
  actions:{
    resetMap() {
      this.center = [-108, 39]
      this.projection = 'EPSG:4326';
      this.zoom = 12;
      this.rotation = 0;
      this.selectedLayer = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
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
  },
});