<template>
  <form class="select-src">
    <select v-model="mapParamsStore.selectedLayer" class="select-default">
      <option value="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}">
        Esri-World-Topo
      </option>
      <option value="https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png">
        OpenStreet
      </option>
      <option value="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}">
        Google
      </option>
    </select>
  </form>
    <ol-map 
      :loadTilesWhileAnimating="true"
      :loadTilesWhileInteracting="true"
      style="height: 800px; border-radius: 15px; overflow: hidden;"
    >
      <ol-view
        ref="view"
        :center="mapParamsStore.center"
        :projection="mapParamsStore.projection"
        :zoom="mapParamsStore.zoom"
        :rotation="mapParamsStore.rotation"
        :resolution="mapParamsStore.resolution"
        @change:center="centerChanged"
        @change:resolution="resolutionChanged"
        @change:rotation="rotationChanged"
      />
  
      <ol-tile-layer>
        <ol-source-xyz :url="mapParamsStore.selectedLayer" minResolution="0.000002"/>
      </ol-tile-layer>
  
      <ol-rotate-control></ol-rotate-control>
    </ol-map>
  
    <ul>
      <li>center : {{ mapParamsStore.center }}</li>
      <li>projection : {{ mapParamsStore.projection }}</li>
      <li>zoom : {{ mapParamsStore.zoom }}</li>
      <li>rotation : {{ mapParamsStore.rotation }}</li>
    </ul>
</template>
  
<script setup lang="ts">

  import { useMapParamsStore } from "@/stores/mapParamsStore.js";

  const mapParamsStore = useMapParamsStore();

  function resolutionChanged(event: any) {
    if (event.target.getZoom() < 0.000002) {
      mapParamsStore.setZoom(0.000002);
    } else {
      mapParamsStore.setZoom(event.target.getZoom());
    }
    mapParamsStore.setZoom(event.target.getZoom());
  }
  function centerChanged(event: any) {
    mapParamsStore.setCenter(event.target.getCenter());
  }
  function rotationChanged(event: any) {
    mapParamsStore.setRotation(event.target.getRotation());
  }
</script>
<style scoped>
.select-src {
  margin-bottom: 0.25rem;
} 
</style>