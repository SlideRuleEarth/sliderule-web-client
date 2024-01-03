import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMapParamsStore = defineStore('mapParamsStore', {
  state: () => ({
    center: ref([-95, 35]),
    projection: ref("EPSG:4326"),
    zoom: ref(5),
    rotation: ref(0),
    resolution: ref(0),
    selectedLayer: ref("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}")
  }),
  actions:{
    resetMap() {
      this.center = [-95, 35]
      this.projection = 'EPSG:4326';
      this.zoom = 5;
      this.rotation = 0;
      this.resolution = 0;
      this.selectedLayer = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
    },
    setCenter(c:number[]) {
      this.center = c;
    },
    setResolution(r:number) {
      this.resolution = r;
    },
    setRotation(r:number) {
      this.rotation = r;
    },
    setZoom(z:number) {
      this.zoom = z;
    },
  },
});