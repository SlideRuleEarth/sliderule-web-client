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
  <form>
    <fieldset>
      <label for="checkbox">Draw Mode Enabled</label>
      <input type="checkbox" id="checkbox" v-model="mapParamsStore.drawEnabled" />
    </fieldset>
    <fieldset>
      <label for="type">Geometry Type</label>
      <select id="type" class="select-default" v-model="mapParamsStore.drawType">
        <option value="Point">Point</option>
        <option value="LineString">LineString</option>
        <option value="Polygon">Polygon</option>
        <option value="Circle">Circle</option>
      </select>
    </fieldset>
  </form>


  <ol-map 
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    style="height: 800px; border-radius: 15px; overflow: hidden;"
    :controls="[]"
  >
    <ol-view
      ref="view"
      :center="mapParamsStore.center"
      :projection="mapParamsStore.projection"
      :zoom="mapParamsStore.zoom"
      :rotation="mapParamsStore.rotation"
      @change:center="centerChanged"
      @change:resolution="resolutionChanged"
      @change:rotation="rotationChanged"
    />

    <ol-tile-layer>
      <ol-source-xyz :url="mapParamsStore.selectedLayer"/>
    </ol-tile-layer>

    <ol-mouseposition-control />
    <ol-vector-layer>
      <ol-source-vector :projection="mapParamsStore.projection">
        <ol-interaction-draw
          v-if="mapParamsStore.drawEnabled"
          :type="mapParamsStore.drawType"
          @drawend="drawend"
          @drawstart="drawstart"
        >
        <ol-style>
          <ol-style-stroke color="blue" :width="2"></ol-style-stroke>
          <ol-style-fill color="rgba(255, 255, 0, 0.4)"></ol-style-fill>
        </ol-style>
        </ol-interaction-draw>
      </ol-source-vector>

      <ol-style>
        <ol-style-stroke color="red" :width="2"></ol-style-stroke>
        <ol-style-fill color="rgba(255,255,255,0.1)"></ol-style-fill>
        <ol-style-circle :radius="7">
          <ol-style-fill color="red"></ol-style-fill>
        </ol-style-circle>
      </ol-style>
    </ol-vector-layer>
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

  const drawstart = (event: any) => {
    console.log(event);
  };

  const drawend = (event: any) => {
    console.log(event);
  };

</script>
<style scoped>
.select-src {
  margin-bottom: 0.25rem;
} 
</style>