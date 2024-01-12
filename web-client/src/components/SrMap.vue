  
<script setup lang="ts">
  import { useWmsCap } from "@/composables/useWmsCap.js"; 
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref, watch, onMounted } from "vue";
  import type Map from "ol/Map.js";
  import {createStringXY} from 'ol/coordinate';
  import SrDrawButtonBox from "@/components/SrDrawButtonBox.vue";
  import SrDrawControl from "@/components/SrDrawControl.vue";

  const stringifyFunc = createStringXY(4);
  const {cap} = useWmsCap();
  const mapRef = ref<{ map: Map }>();
  const mapParamsStore = useMapParamsStore();
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
    const map = mapRef.value?.map;
    if(map){
      //provide('theMap', map); // provide map to all children
      console.log(mapRef)
      console.log(map);
      map.addControl(cap)
    } else {
      console.log("map is null");
    }
    console.log(mapParamsStore.layerList);
  });

  const handleCustomControlCreated = (customControl: any) => {
    console.log(customControl);
    const map = mapRef.value?.map;
    if(map){
      map.addControl(customControl);
    } else {
      console.log("map is null");
    }
  };
  
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
  <div>
    <SrDrawButtonBox label="test"/>
  </div>
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

    <ol-layerswitcher-control 
      :selection="true"
      :displayInLayerSwitcher="true"
      :show_progress="true"
      :mouseover="false"
      :reordering="true"
      :trash="false"
      :extent="true"
    />
    <!-- <sr-radio-button /> -->
    <ol-tile-layer ref="base" title="base layer">
      <ol-source-xyz :url="mapParamsStore.baseLayer.url" :title="mapParamsStore.baseLayer.title"/>
    </ol-tile-layer>

    <ol-zoom-control  />
    
    <ol-mouseposition-control 
      :coordinateFormat="stringifyFunc"
    />

    <ol-scaleline-control />
    <SrDrawControl @customControlCreated="handleCustomControlCreated" />

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
    <!-- <ol-rotate-control></ol-rotate-control> -->
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

::v-deep(.ol-overlaycontainer-stopevent) {
  position: relative;
  display: flex !important;
  flex-direction: column; /* Stack children vertically */
  justify-content: flex-start; /* Align children to the top */
  align-items: flex-end; /* Align children to the right */
  height: 100%; /* Ensure the container has height */
  background-color: var(--white);
  border-radius: 8px;
  padding: 0.25rem;
  border: 1px solid var(--primary-color);
}


::v-deep( .ol-control.ol-layerswitcher ){
  top: 2.5rem;
  bottom: auto;
  left: 0.5em;
  right: auto;
  background-color: transparent;
  border-radius: var(--border-radius);
  border: 1px ;

}

::v-deep( .ol-control.ol-layerswitcher button ){
  background-color: transparent;
  border-radius: var(--border-radius);
}

::v-deep(.ol-control.ol-layerswitcher .panel-container){
  background-color: var(--primary-100);
  color: var(--primary-color);
  border-radius: var(--border-radius);
}

::v-deep(.panel-container.ol-ext-dialog){
  background-color: transparent;
}

::v-deep(.ol-ext-dialog .ol-closebox.ol-title){
  color: var(--text-color);
  background-color: var(--primary-300);
  font-family: var(--font-family);
  border-radius: var(--border-radius);
}

::v-deep(.ol-ext-dialog .ol-content .ol-wmscapabilities .ol-url .url){
  color: white;
  background-color: var(--primary-600);
}

::v-deep( .ol-control.ol-wmscapabilities  ) {
  top: 0.5rem;
  bottom: auto;
  left: 0.5em;
  right: auto;
  border-radius: var(--border-radius);
  background-color: transparent;
  padding: 0.45rem;
}
::v-deep(.ol-wmscapabilities .ol-url button){
  color: white;
  border-radius: var(--border-radius);
  background-color: var(--primary-400);
}

::v-deep(.ol-wmscapabilities .ol-url option){
  color: white;
  background-color: var(--primary-400);
}

::v-deep(.ol-zoom){
  top: 00.5em; 
  right: 0.5em; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: 5px;
  margin: auto;
}

::v-deep(.ol-mouse-position) {
  color: var(--primary-color);
  top: 0.5em; 
  right: auto; /* Override the default positioning */
  left: 50%; /* Center align */
  transform: translateX(-50%); /* Adjust for the element's width */

}

::v-deep(.ol-zoom .ol-zoom-in) {
  margin: 2px;
  border-radius: 5px;
  background-color: black;
  border-bottom: 1px;
  border-bottom-color: white;
  color: var(--ol-font-color);
  font-weight: normal;
}

::v-deep(.ol-zoom .ol-zoom-out) {
  margin: 2px;
  border-radius: 5px;
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}


</style>