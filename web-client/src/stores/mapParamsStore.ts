import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMapParamsStore = defineStore('mapParamsStore', () => {
  const center = ref([-95, 35]);
  const projection = ref("EPSG:4326");
  const zoom = ref(5);
  const rotation = ref(0);
  const selectedLayer = ref("https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  function reset_map() {
    center.value = [-95, 35];
    projection.value = 'EPSG:4326';
    zoom.value = 5;
    rotation.value = 0;
    selectedLayer.value = "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  return { center, projection, zoom, rotation, selectedLayer, reset_map };
});