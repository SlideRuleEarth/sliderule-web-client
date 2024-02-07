  
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
  import XYZ from 'ol/source/XYZ.js';
  import WMTS from 'ol/source/WMTS.js';
  import WMTSTileGrid from 'ol/tilegrid/WMTS.js';

  import Layer from 'ol/layer/Layer.js';
  import TileLayer from 'ol/layer/Tile.js';
  import ImageLayer from 'ol/layer/Image.js';
  import Permalink from "ol-ext/control/Permalink";
  import BaseEvent from "ol/events/Event";
  import { SrBaseLayer } from "@/composables/SrBaseLayers";

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
  function updateCurrentParms(){
    const newZoom = mapRef.value?.map.getView().getZoom();
    if (newZoom !== undefined) {
      mapParamsStore.setZoom(newZoom);
    }
    const newCenter = mapRef.value?.map.getView().getCenter();
    if (newCenter !== undefined) {
      mapParamsStore.setCenter(newCenter);
    }
    const newRotation = mapRef.value?.map.getView().getRotation();
    if (newRotation !== undefined) {
      mapParamsStore.setRotation(newRotation);
    }
    const newProjection = mapRef.value?.map.getView().getProjection().getCode();
    if (newProjection !== undefined) {
      const newName = newProjection
      mapParamsStore.setProjName(newName);
    }
    const newExtent = mapRef.value?.map.getView().calculateExtent();
    if (newExtent !== undefined) {
      mapParamsStore.setExtent(newExtent);
    }
  }

  function onResolutionChange(){
    //console.log("onResolutionChange:",event);
    updateCurrentParms();
  };

  onMounted(() => {
    if (mapRef.value?.map) {
      mapStore.setMap(mapRef.value?.map);
      const map = mapStore.getMap();
      if(map){
        if(wms_capabilities_cntrl){
          map.addControl(wms_capabilities_cntrl);
          var plink = new Permalink({ visible: false, localStorage: 'position' });
          map.addControl(plink);
          let et:any = 'load';
          wms_capabilities_cntrl.on(et,(event: BaseEvent) => {
            const e = event as any;
            map.addLayer(e.layer);
            e.layer.set('legend', e.options.data.legend);
            plink.setUrlParam('url', e.options.source.url);
            plink.setUrlParam('layer', e.options.source.params.LAYERS);
          });

        } else {
          console.log("Error:wms_capabilities_cntrl null");
        }
        if(!geoCoderStore.isInitialized()){
          //console.log("Initializing geocoder");
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
        const initialZoom = map.getView().getZoom();
        if (initialZoom !== undefined) {
          mapParamsStore.setZoom(initialZoom);
        }
        // Watch for changes in the zoom level
        map.getView().on('change:resolution', onResolutionChange);
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

  const updateProjection = (projection: SrProjection) => {
    console.log("oldProjName:",mapParamsStore.getProjName())
    const oldProj = getProjection(mapParamsStore.getProjName());
    const newProj = getProjection(projection.name);
    //console.log("oldProj:",oldProj);
    console.log("updateProjection newProj:",newProj);
    if (newProj && oldProj) {
      let extent = newProj.getExtent();
      const fromLonLat = getTransform('EPSG:4326', newProj);
      if (projection.bbox){
        if ((projection.name == 'EPSG:5936') || (projection.name == 'EPSG:3031')){
          console.log("projection.bbox:",projection.bbox);
          let worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3], projection.bbox[0]];
          newProj.setWorldExtent(worldExtent);
          // approximate calculation of projection extent,
          // checking if the world extent crosses the dateline
          if (projection.bbox[1] > projection.bbox[3]) {
            worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3] + 360, projection.bbox[0]];
          }
          console.log("worldExtent:",worldExtent);
          extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
          console.log("extent:",extent);
        }
        newProj.setExtent(extent);
        const newView = new View({
            projection: newProj,
            constrainResolution: true,
        });
        const map = mapRef.value?.map;
        if(map){
          map.setView(newView);
          newView.fit(extent);
          // Watch for changes in the zoom level

          map.getView().on('change:resolution', onResolutionChange);
          let z = projection.default_zoom 
          if (z !== undefined){
            map.getView().setZoom(z);
          } else {
            console.log("Error:default_zoom is undefined");
          }
          let min_z = projection.min_zoom 
          if (min_z !== undefined){
            map.getView().setMinZoom(min_z);
          } else {
            console.log("Error:min_zoom is undefined");
          }
          let max_z = projection.max_zoom 
          if (max_z !== undefined){
            map.getView().setMaxZoom(max_z);
          } else {
            console.log("Error:max_zoom is undefined");
          }
        } else {
          console.log("Error:map is null");
        }
      } else {
        console.log("Error: invalid projection bbox:",projection.bbox);
      }
    } else {
      console.log("Error: invalid projection name:",projection.name);
    }
    mapParamsStore.setProjection(projection);
    mapParamsStore.setProjName(projection.name);
    updateCurrentParms();
  }

  // const transformProjection = (projection: SrProjection) => {
  //   console.log("oldProjName:",mapParamsStore.getProjName())
  //   const oldProj = getProjection(mapParamsStore.getProjName());
  //   const newProj = getProjection(projection.name);
  //   //console.log("oldProj:",oldProj);
  //   console.log("updateProjection newProj:",newProj);
  //   if (newProj && oldProj) {
  //     let extent = newProj.getExtent();
  //     const fromLonLat = getTransform('EPSG:4326', newProj);
  //     if (projection.bbox){
  //       if ((projection.name == 'EPSG:5936') || (projection.name == 'EPSG:3031')){
  //         console.log("projection.bbox:",projection.bbox);
  //         let worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3], projection.bbox[0]];
  //         newProj.setWorldExtent(worldExtent);
  //         // approximate calculation of projection extent,
  //         // checking if the world extent crosses the dateline
  //         if (projection.bbox[1] > projection.bbox[3]) {
  //           worldExtent = [projection.bbox[1], projection.bbox[2], projection.bbox[3] + 360, projection.bbox[0]];
  //         }
  //         console.log("worldExtent:",worldExtent);
  //         extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
  //         console.log("extent:",extent);
  //       }
  //       newProj.setExtent(extent);
  //       const newView = new View({
  //           projection: newProj,
  //           constrainResolution: true,
  //       });
  //       const map = mapRef.value?.map;
  //       if(map){
  //         map.setView(newView);
  //         newView.fit(extent);
  //         // Watch for changes in the zoom level

  //         map.getView().on('change:resolution', onResolutionChange);
  //         let z = projection.default_zoom 
  //         if (z !== undefined){
  //           map.getView().setZoom(z);
  //         } else {
  //           console.log("Error:default_zoom is undefined");
  //         }
  //         let min_z = projection.min_zoom 
  //         if (min_z !== undefined){
  //           map.getView().setMinZoom(min_z);
  //         } else {
  //           console.log("Error:min_zoom is undefined");
  //         }
  //         let max_z = projection.max_zoom 
  //         if (max_z !== undefined){
  //           map.getView().setMaxZoom(max_z);
  //         } else {
  //           console.log("Error:max_zoom is undefined");
  //         }
  //       } else {
  //         console.log("Error:map is null");
  //       }
  //     } else {
  //       console.log("Error: invalid projection bbox:",projection.bbox);
  //     }
  //   } else {
  //     console.log("Error: invalid projection name:",projection.name);
  //   }
  //   mapParamsStore.setProjection(projection);
  //   mapParamsStore.setProjName(projection.name);
  //   updateCurrentParms();
  // };

  const handleUpdateProjection = (projection: SrProjection) => {
    console.log("handleUpdateProjection:",projection);
    updateProjection(projection);
  };

  const handleUpdateBaseLayer = (baseLayer: SrBaseLayer) => {
    console.log("handleUpdateBaseLayer:",baseLayer);
    const oldBaseLayer = mapParamsStore.baseLayer;
    mapParamsStore.baseLayer = baseLayer;
    let found = false;
    mapRef.value?.map.getAllLayers().forEach((layer: Layer) => {
      console.log("layer:",layer)
      console.log("layer.get('title'):",layer.get('title'));
      console.log("oldBaseLayer.title:",oldBaseLayer.title)
      console.log("mapRef.value?.map.getView()",mapRef.value?.map.getView());
      if(layer){
        if (layer.get('title') === baseLayer.title) {
          found = true;
        }
      } else {
        console.log("Error:layer is null");
      }      
    });
    if (!found){
      console.log("adding layer:",baseLayer);
      //mapRef.value?.map.removeLayer(layer);
      let myOptions = {
        title: baseLayer.title
      };
      if(baseLayer.type == "wmts"){
        console.log("adding wmts layer")
        // mapRef.value?.map.addLayer(new TileLayer<WMTS>({
        //   source: new WMTS({
        //     url: baseLayer.url,
        //   }),
        //   ... myOptions})
        // );

        var source = new WMTS({
          url: "https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3031/best/wmts.cgi?TIME=2013-12-01",
          layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
          format: 'image/jpeg',
          matrixSet: '250m',

          tileGrid: new WMTSTileGrid({
            origin: [-4194304, 4194304],
            resolutions: [
              8192.0,
              4096.0,
              2048.0,
              1024.0,
              512.0,
              256.0
            ],
            matrixIds: [0, 1, 2, 3, 4, 5],
            tileSize: 512
          })
        });

      var layer = new TileLayer({
        source: source,
        extent: [-4194304, -4194304, 4194304, 4194304]
      });
      mapRef.value?.map.addLayer(layer);





      } else {
        console.log("adding xyz layer")
        mapRef.value?.map.addLayer(new TileLayer<XYZ>({
          source: new XYZ({
            url: baseLayer.url,
          }),
          ... myOptions})
        );
      }
    }
    updateProjection(mapParamsStore.projection);
  };
 

</script>

<template>
  <div class="current-zoom">
    {{  mapParamsStore.getZoom() }}
  </div>
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
    <ol-tile-layer ref=mapParamsStore.baseLayer :title=mapParamsStore.tile_title>
      <ol-source-xyz :url="mapParamsStore.baseLayer.url" :title="mapParamsStore.baseLayer.title"/>
    </ol-tile-layer>

    <ol-zoom-control  />
    
    <ol-mouseposition-control 
      :coordinateFormat="stringifyFunc"
    />

    <ol-scaleline-control />
    <SrDrawControl @drawControlCreated="handleDrawControlCreated" @pickedChanged="handlePickedChanged" />
    <SrProjectionControl @projectionControlCreated="handleProjectionControlCreated" @updateProjection="handleUpdateProjection"/>
    <SrBaseLayerControl @baseLayerControlCreated="handleBaseLayerControlCreated" @updateBaseLayer="handleUpdateBaseLayer"/>
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
  <div class="current-view-params">
    <span>currentZoom: {{  mapParamsStore.getZoom() }} </span><br>
    <span>currentCenter: {{  mapParamsStore.getCenter() }}</span><br>
    <span>currentRotation: {{  mapParamsStore.getRotation() }}</span><br>
    <span>currentProjection: {{  mapParamsStore.getProjName()}}</span><br>
    <span>currentExtent: {{  mapParamsStore.getExtent() }}</span>
  </div>

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
  top: 6.25rem;
  bottom: auto;
  left: 0.0rem;
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
  top: 2.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
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
  left: 0.5rem;
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
  left: 5.5rem;
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
  top: 4.5rem;
  bottom: auto;
  left: 0.5rem;
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

.current-zoom {
  position: absolute;
  top: 2.25rem;
  right: 1.5rem;
  background-color: transparent;
  color: var(--primary-color);
  border-radius: var(--border-radius);
  border-color: white;
  padding: 0.0rem;
  margin-top: 6px;
  margin-bottom: -2px;

  font-size: 0.75rem;
}
</style>