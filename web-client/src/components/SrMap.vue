  
<script setup lang="ts">
  import { useWmsCap } from "@/composables/useWmsCap.js"; 
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref, watch, onMounted } from "vue";
  import type Map from "ol/Map.js";

  const {cap} = useWmsCap();
  const mapRef = ref<{ map: Map }>();
  const mapParamsStore = useMapParamsStore();
  //const ahocevarLayer = ref(null);
  //const layerOpacity = ref(0.1);
  //const layerVisible = ref(true);
  const controls = ref([]);
  const selectedBaseLayer = ref(mapParamsStore.baseLayer);

  const baseLayers = ref([
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      title: "Esri-World-Topo"
    },
    {
      url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      title: "OpenStreet"
    },
    {
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      title: "Google"
    }
  ]);

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

  const handleEvent = (event: any) => {
    console.log(event);
  };
  const drawstart = (event: any) => {
    console.log(event);
  };

  const drawend = (event: any) => {
    console.log(event);
  };

  onMounted(() => {
    // mapParamsStore.addLayer(ahocevarLayer.value.tileLayer);
    // mapParamsStore.addLayer(glimsLayer.value.tileLayer);
    const map: Map | undefined = mapRef.value?.map;

    if (map) {
      map.addControl(cap)
      console.log('add capabilities control to map');
    } else {
      console.log("map is null");
    }
    console.log(mapParamsStore.layerList);
  });

  watch(selectedBaseLayer, (newLayer) => {
    mapParamsStore.setBaseLayer(newLayer.url, newLayer.title);
  });

</script>
<template>
  <form class="select-src">
    <select v-model="selectedBaseLayer" class="select-default">
      <option v-for="layer in baseLayers" :value="layer" :key="layer.title">
        {{ layer.title }}
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
        <option value="Polygon">Polygon</option>
        <option value="Circle">Circle</option>
      </select>
    </fieldset>
  </form>
  <ol-map ref="mapRef" @error="handleEvent"
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    style="height: 800px; border-radius: 15px; overflow: hidden;"
    :controls="controls"
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

    <!-- <ol-layerswitcher-control 
      :selection="true"
      :displayInLayerSwitcher="true"
      :show_progress="true"
      :mouseover="true"
      :reordering="true"
      :trash="false"
    /> -->

    <ol-tile-layer ref="base" title="base layer">
      <ol-source-xyz :url="mapParamsStore.baseLayer.url" :title="mapParamsStore.baseLayer.title"/>
    </ol-tile-layer>

    <!-- <ol-tile-layer ref="ahocevarLayer" title="Ahocevar"
      :zIndex="1001"
      :opacity="layerOpacity"
      :visible="layerVisible"
    >
      <ol-source-tile-wms 
        url="https://ahocevar.com/geoserver/wms"
        :extent="[-13884991, 2870341, -7455066, 6338219]"
        layers="topp:states"
        serverType="geoserver"
        :transition="0"
      />
    </ol-tile-layer> -->

    <ol-mouseposition-control />
    <ol-scaleline-control />
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

<style scoped>
.select-src {
  margin-bottom: 0.25rem;
}
::v-deep(.ol-mouse-position) {
  color: var(--primary-color);
}
</style>