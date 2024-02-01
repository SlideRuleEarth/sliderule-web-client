  
<script setup lang="ts">
  import { useWmsCap } from "@/composables/useWmsCap.js"; 
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref, onMounted } from "vue";
  import type Map from "ol/Map.js";
  import View from "ol/View.js";
  import {createStringXY} from 'ol/coordinate';
  import SrDrawControl from "@/components/SrDrawControl.vue";
  import {useToast} from "primevue/usetoast";
  import VectorLayer from 'ol/layer/Vector';
  import VectorSource from 'ol/source/Vector';
  import Geometry from 'ol/geom/Geometry';
  import Feature from 'ol/Feature';
  import SrBaseLayerControl from "./SrBaseLayerControl.vue";
  import SrProjectionControl from "./SrProjectionControl.vue";
  import { SrProjection } from "@/composables/SrProjections";
  import {get as getProjection, getTransform} from 'ol/proj.js';
  import {applyTransform} from 'ol/extent.js';
  import 'ol/ol.css'; 
  import 'ol-geocoder/dist/ol-geocoder.min.css';
  import { useMapStore } from "@/stores/mapStore";
  import { useGeoCoderStore } from '@/stores/geoCoderStore';
  
  const geoCoderStore = useGeoCoderStore();
  const stringifyFunc = createStringXY(4);
  const {wms_capabilities_cntrl} = useWmsCap();
  const mapRef = ref<{ map: Map }>();
  const mapParamsStore = useMapParamsStore();
  const mapStore = useMapStore();

  const controls = ref([]);
  const toast = useToast();

  const handleEvent = (event: any) => {
    console.log(event);
  };
  const drawstart = (event: any) => {
    console.log("drawstart:",event);
  };

  const drawend = (event: any) => {
    console.log("drawend:",event);
  };

  const handlePickedChanged = (newPickedValue: string) => {
    console.log("Draw Picked value changed: " + newPickedValue);
    if (newPickedValue === 'TrashCan'){
      console.log("Clearing drawing layer");
      // Access the vector layer's source and clear it
      const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('title') === 'drawing layer') as VectorLayer<VectorSource<Feature<Geometry>>>;
      console.log("vectorLayer:",vectorLayer);  
      if (vectorLayer) {
        toast.add({ severity: 'info', summary: 'Clear vector layer', detail: 'Deleted all drawn items', life: 3000 });

        const vectorSource = vectorLayer.getSource();
        if(vectorSource){
          vectorSource.clear();
        } else {
          console.log("Error:vectorSource is null");
        }
      }
    }
  };

  // Define a function to handle the addresschosen event
  function onAddressChosen(evt: any) {
    //console.log(evt);
    // Zoom to the selected location
    const map = mapStore.getMap();
    if(map){
        const view = map.getView();
        if (view) {
            view.animate({
                center: evt.coordinate,
                duration: 1000,
                zoom: 10,
            });
        } else {
            console.error('View is not defined');
        }
    } else {
        console.error('Map is not defined');
    }
  }

  onMounted(() => {
    if (mapRef.value?.map) {
      mapStore.setMap(mapRef.value?.map);
      const map = mapStore.getMap();
      if(map){
        if(wms_capabilities_cntrl){
          map.addControl(wms_capabilities_cntrl);
        } else {
          console.log("Error:wms_capabilities_cntrl null");
        }
        if(!geoCoderStore.isInitialized()){
          console.log("Initializing geocoder");
          geoCoderStore.initGeoCoder({
            provider: 'osm',
            lang: 'en',
            placeholder: 'Search for ...',
            targetType: 'glass-button',
            limit: 5,
            keepOpen: false,
            //target: 'geoCoderContainer'
          });
        }
        const geocoder = geoCoderStore.getGeoCoder()

        if(geocoder){       
          map.addControl(geocoder);
          geocoder.on('addresschosen', onAddressChosen); 
        } else {
          console.log("Error:geocoder is null?");
        }
      } else {
        console.log("Error:map is null");
      } 
    }
  });

  const handleDrawControlCreated = (drawControl: any) => {
    //console.log(drawControl);
    const map = mapRef.value?.map;
    if(map){
      map.addControl(drawControl);
    } else {
      console.log("Error:map is null");
    }
  };

  const handleBaseLayerControlCreated = (baseLayerControl: any) => {
    //console.log(baseLayerControl);
    const map = mapRef.value?.map;
    if(map){
      //console.log("adding baseLayerControl");
      map.addControl(baseLayerControl);
    } else {
      console.log("Error:map is null");
    }
  };

  const handleProjectionControlCreated = (projectionControl: any) => {
    //console.log(projectionControl);
    const map = mapRef.value?.map;
    if(map){
      //console.log("adding projectionControl");
      map.addControl(projectionControl);
    } else {
      console.log("Error:map is null");
    }
  };

  const handleUpdateProjection = (projection: SrProjection) => {
    //console.log("Map handleUpdateProjection:",projection);
    const oldProj = getProjection(mapParamsStore.projection.name);

    const newProj = getProjection(projection.name);
    if (newProj && oldProj) {

      const fromLonLat = getTransform('EPSG:4326', newProj);
      //const fromLonLat = getTransform(oldProj, newProj);
      if (projection.bbox){
        let worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3], projection.bbox[0]];
        newProj.setWorldExtent(worldExtent);
        // approximate calculation of projection extent,
        // checking if the world extent crosses the dateline
        if (projection.bbox[1] > projection.bbox[3]) {
          worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3] + 360, projection.bbox[0]];
        }
        const extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
        newProj.setExtent(extent);
        const newView = new View({
            projection: newProj,
            constrainResolution: true,
        });
        const map = mapRef.value?.map;
        if(map){
          map.setView(newView);
          newView.fit(extent);
          //console.log("Map handleUpdateProjection newView:",newView);
        } else {
          console.log("Error:map is null");
        }
      } else {
        console.log("Error: invalid projection bbox:",projection.bbox);
      }
    } else {
      console.log("Error: invalid projection name:",projection.name);
    }
    mapParamsStore.projection = projection;
};

</script>

<template>

  <ol-map ref="mapRef" @error="handleEvent"
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    style="height: 800px; border-radius: 15px; overflow: hidden;"
    :controls="controls"
  >
    <ol-layerswitcher-control 
      :selection="true"
      :displayInLayerSwitcher="true"
      :show_progress="true"
      :mouseover="false"
      :reordering="true"
      :trash="false"
      :extent="true"
    />
    <ol-tile-layer ref="base" :title="mapParamsStore.baseLayer.title">
      <ol-source-xyz :url="mapParamsStore.baseLayer.url" :title="mapParamsStore.baseLayer.title"/>
    </ol-tile-layer>

    <ol-zoom-control  />
    
    <ol-mouseposition-control 
      :coordinateFormat="stringifyFunc"
    />

    <ol-scaleline-control />
    <SrDrawControl @drawControlCreated="handleDrawControlCreated" @pickedChanged="handlePickedChanged" />
    <SrProjectionControl @projectionControlCreated="handleProjectionControlCreated" @updateProjection="handleUpdateProjection"/>
    <SrBaseLayerControl @baseLayerControlCreated="handleBaseLayerControlCreated" />
    <ol-vector-layer title="drawing layer">
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
  </ol-map>

</template>

<style scoped>

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
  top: 0.25rem;
  bottom: auto;
  left: 4.55em;
  right: auto;
  background-color: transparent;
  border-radius: var(--border-radius);
  border: 1px ;

}

::v-deep( .ol-control.ol-layerswitcher button ){
  background-color: transparent;
  border-radius: var(--border-radius);
}
::v-deep( .ol-control.ol-layerswitcher > button::before ){
  border-radius: var(--border-radius);
}

::v-deep( .ol-control.ol-layerswitcher > button::after ){
  border-radius: var(--border-radius);
}

::v-deep( .panel-container .ol-layerswitcher-buttons ){
  background-color: transparent;
}
::v-deep(.layerup.ol-noscroll){
  border-radius: 3px;
  background-color: var(--primary-color);
}
::v-deep(.ol-control.ol-layerswitcher .panel-container){
  background-color: var(--primary-100);
  color: var(--primary-color);
  border-radius: var(--border-radius);
}

/* ::v-deep(.ol-control.ol-layerswitcher .panel-container .ul.panel){
  background-color: red;
  color: red;
  border-radius: var(--border-radius);
} */
::v-deep(.ol-layerswitcher label){
  background-color: transparent;
  color: var(--primary-color);
  font-weight: bold;
  font-family: var(--font-family);
  border-radius: var(--border-radius);
} 

::v-deep(.ol-layerswitcher .panel .li-content > label::before){
  border-radius: 2px;
  border-color: var(--primary-color);
  border-width: 2px;
} 

/* ::v-deep(.ol-layerswitcher .panel-container .li-content > label::after){
  border-width: 1px;
  background-color: var(--primary-color);

}  */
::v-deep(.panel-container.ol-ext-dialog){
  background-color: transparent;
}

::v-deep(.ol-ext-dialog .ol-closebox.ol-title){
  color: var(--text-color);
  background-color: var(--primary-300);
  font-family: var(--font-family);
  border-radius: var(--border-radius);
}

::v-deep(.ol-geocoder){
  top: 0.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: black;
  border-radius: var(--border-radius);
  color: white;
  max-width: 30rem; 
}

::v-deep(.gcd-gl-control){
  background-color: transparent;
  border-radius: var(--border-radius);
}

::v-deep( .ol-control.sr-projection-control ){
  top: 0.55rem;
  bottom: auto;
  left: 7.0rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--border-radius);
  color: white;
  max-width: 30rem; 
}

::v-deep( .ol-control.sr-base-layer-control ){
  top: 0.55rem;
  bottom: auto;
  right: auto;
  left: 11.5rem;
  background-color: transparent;
  border-radius: var(--border-radius);
  color: white;
  max-width: 30rem; 
}
::v-deep(.ol-ext-dialog .ol-content .ol-wmscapabilities .ol-url .url){
  color: white;
  background-color: var(--primary-600);
}

::v-deep( .ol-control.ol-wmscapabilities  ) {
  top: 0.5rem;
  bottom: auto;
  left: 3.0rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--border-radius);
  padding: 0.125rem;
  border: 1px ;
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
  top: 0.5rem; 
  right: 0.5rem; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: var(--border-radius);
  margin: auto;
  font-size: 1.25rem;
}

::v-deep(.sr-draw-control){
  top: 5.5rem; 
  right: 0.55rem; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: var(--border-radius);
}

::v-deep(.ol-mouse-position) {
  bottom: 0.5rem; /* Position from the bottom */
  left: 50%; /* Center align horizontally */
  right: auto; /* Reset right positioning */
  top: auto; /* Unset top positioning */
  transform: translateX(-50%); /* Adjust for the element's width */
  color: var(--primary-color);
}

::v-deep(.ol-zoom .ol-zoom-in) {
  margin: 2px;
  border-radius: var(--border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}

::v-deep(.ol-zoom .ol-zoom-out) {
  position: relative;
  margin: 2px;
  border-radius: var(--border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}

::v-deep(.ol-zoom .ol-zoom-out):before {
  content: '';
  position: absolute;
  top: 0px;
  left: 25%; /* Adjust this value to control where the border starts */
  right: 25%; /* Adjust this value to control where the border ends */
  border-top: 1px dashed rgb(200, 200, 200);
}

</style>