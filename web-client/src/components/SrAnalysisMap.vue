<script setup lang="ts">
  import { useMapStore } from "@/stores/mapStore";
  import { useMapParamsStore } from "@/stores/mapParamsStore";
  import { ref, onMounted, watch, computed } from "vue";
  import type OLMap from "ol/Map.js";
  import {createStringXY} from 'ol/coordinate';
  import SrBaseLayerControl from "./SrBaseLayerControl.vue";
  import SrViewControl from "./SrViewControl.vue";
  import ProgressSpinner from "primevue/progressspinner";
  import { type SrView } from "@/composables/SrViews";
  import { useProjectionNames } from "@/composables/SrProjections";
  import { srProjections } from "@/composables/SrProjections";
  import proj4 from 'proj4';
  import { register } from 'ol/proj/proj4';
  import 'ol/ol.css'; 
  import 'ol-geocoder/dist/ol-geocoder.min.css';
  import { get as getProjection } from 'ol/proj.js';
  import { getTransform } from 'ol/proj.js';
  import { addLayersForCurrentView,getLayer,getDefaultBaseLayer } from "@/composables/SrLayers";
  import View from 'ol/View';
  import { applyTransform } from 'ol/extent.js';
  import Layer from 'ol/layer/Layer';
  import { useWmsCap } from "@/composables/useWmsCap";
  import { getDefaultProjection } from '@/composables/SrProjections';
  import  { getCenter as getExtentCenter } from 'ol/extent.js';
  import { type SrLayer } from '@/composables/SrLayers';
  import { onActivated } from "vue";
  import { onDeactivated } from "vue";
  import SrCurrentMapViewParms from './SrCurrentMapViewParms.vue';
  import { updateDeck } from '@/utils/SrMapUtils';
  import { readAndUpdateElevationData } from "@/utils/SrParquetUtils";
  import  SrLegendControl  from "./SrLegendControl.vue";
  import { readOrCacheSummary } from "@/utils/SrParquetUtils";
  import { useSrParquetCfgStore } from "@/stores/srParquetCfgStore";
  import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
  import { useToast } from "primevue/usetoast";

  const stringifyFunc = createStringXY(4);
  const mapContainer = ref<HTMLElement | null>(null);
  const mapRef = ref<{ map: OLMap }>();
  const mapParamsStore = useMapParamsStore();
  const mapStore = useMapStore();
  const controls = ref([]);
  const toast = useToast();
  const handleEvent = (event: any) => {
    console.log(event);
  };
  const atlChartFilterStore = useAtlChartFilterStore();
  const elevationIsLoading = computed(() => mapStore.getIsLoading());
  const func = computed(() => atlChartFilterStore.getFunc());

  const props = defineProps({
      reqId: {
          type: Number,
          required: true
      }
  });

  // Watch for changes on reqId
  watch(() => props.reqId, (newReqId, oldReqId) => {
    console.log(`reqId changed from ${oldReqId} to ${newReqId}`);
    updateAnalysisMapView("New reqId");  
  });


  // Watch for changes on parquetReader
  watch(() => useSrParquetCfgStore().parquetReader, (newReader, oldReader) => {
    console.log(`parquet reader changed from ${oldReader} to ${newReader}`);
    updateAnalysisMapView("New parquetReader");
  });

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
    console.log("SrAnalysisMap onMounted using reqId:",props.reqId);
    mapStore.setIsLoading();
    //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
    Object.values(srProjections.value).forEach(projection => {
        //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
        proj4.defs(projection.name, projection.proj4def);
    });
    register(proj4);
    if (mapRef.value?.map) {
      mapStore.setMap(mapRef.value.map);
      const map = mapStore.getMap() as OLMap;
      if(map){
        const initialZoom = map.getView().getZoom();
        if (initialZoom !== undefined) {
          mapParamsStore.setZoom(initialZoom);
        }
        const projectionNames = useProjectionNames();

        projectionNames.value.forEach(name => {
          const wmsCap = useWmsCap(name);
          if(wmsCap){ 
            mapStore.cacheWmsCapForProjection(name, wmsCap);
          } else {
            console.error(`Error: no wmsCap for projection: ${name}`);
          }
          //
          // TBD WMTS element is same as WMS element, can't add both?
          //
          // const wmtsCap = useWmtsCap(name);
          // if(wmtsCap){ 
          //   mapStore.cacheWmtsCapForProjection(name, wmtsCap);
          // } else {
          //   console.error(`Error: no wmtsCap for projection: ${name}`);
          // }
        });
        mapStore.setCurrentWmsCap(mapParamsStore.getProjection());
        const defaultBaseLayer = getDefaultBaseLayer(getDefaultProjection().name);
        if(defaultBaseLayer){
          const newLayer = getLayer(defaultBaseLayer.title);
          if(mapStore.map){
            console.log('adding Base Layer', newLayer);
            mapStore.map.addLayer(newLayer);
          } else {
            console.log('map not available');
          }    
        }
        //mapStore.setCurrentWmtsCap(mapParamsStore.getProjection());

        updateAnalysisMapView("onMounted");

      } else {
        console.log("Error:map is null");
      } 
    } else {
      console.error("Error:map is null");
    }

  });

  onActivated(() => {
    console.log("SrAnalysisMap onActivated");
  })

  onDeactivated(() => {
    console.log("SrAnalysisMap onDeactivated");
  })

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

  const handleViewControlCreated = (viewControl: any) => {
    //console.log(viewControl);
    const map = mapRef.value?.map;
    if(map){
      //console.log("adding viewControl");
      map.addControl(viewControl);
    } else {
      console.error("Error:map is null");
    }
  };

  const handleLegendControlCreated = (legendControl: any) => {
    //console.log(legendControl);
    const map = mapRef.value?.map;
    if(map){
      console.log("adding legendControl");
      map.addControl(legendControl);
    } else {
      console.error("Error:map is null");
    }
  };
  
  const updateAnalysisMapView = async (reason:string) => {
    console.log(`****** SrAnalysisMap updateAnalysisMapView for ${reason} ******`);

    try {
      const map = mapRef.value?.map;
      if(map){
        const srView = mapParamsStore.getSrView();
        let newProj = getProjection('EPSG:4326'); 
        if (newProj ) {

          map.getAllLayers().forEach((layer: Layer) => {
            // drawiing Layer is never changed/removed
            if(layer.get('name') !== 'Drawing Layer'){
              console.log(`removing layer:`,layer.get('title'));
              map.removeLayer(layer);
            } else {
              //console.log(`skipping layer:`,layer.get('name'));
            }
          });
          let baseLayer = mapParamsStore.getSelectedBaseLayer();

          if(srView.name === 'North'){
            //baseLayer = layers.value['Artic Ocean Base'];
            //baseLayer = layers.value['Esri World Topo'];
            //newProj = getProjection('EPSG:5936');
            //newProj = getProjection('EPSG:4326'); // Web default
            //newProj = getProjection('EPSG:3857'); // default openlayers projection
            //newProj = getProjection('EPSG:5936');
          } else if(srView.name === 'South'){
            newProj = getProjection('EPSG:3031');
          //} else if(srView.name === 'North Sea Ice'){
          //  newProj = getProjection('EPSG:3413');
          } else {
            newProj = getProjection('EPSG:3857');
          }
          if(newProj){
            if(baseLayer){
              //console.log('adding Base Layer', baseLayer);
              const layer = getLayer(baseLayer.title);
              map.addLayer(layer);
            } else {
              console.log("Error:baseLayer is null");
            }
            //console.log(`${newProj.getCode()} units: ${newProj.getUnits()}`);
            let extent = newProj.getExtent();
            //console.log("projection's extent:",extent);         
            const fromLonLat = getTransform('EPSG:4326', newProj);
            //console.log("extent:",extent);
            //console.log(`${newProj.getCode()} using our BB:${srView.bbox}`);
            if (srView.bbox){
              // 5936 is North Alaska; 3413 is North Sea Ice;  3031 is South Pole
              if ((newProj.getCode() == 'EPSG:5936') || (newProj.getCode() == 'EPSG:3031') || (newProj.getCode() == 'EPSG:3413')){
                //if(projection.getUnits() == 'm'){
                //console.log("srView.bbox:",srView.bbox);
                let worldExtent = [srView.bbox[1], srView.bbox[2], srView.bbox[3], srView.bbox[0]];
                //projection.setWorldExtent(worldExtent);
                // approximate calculation of projection extent,
                // checking if the world extent crosses the dateline
                if (srView.bbox[1] > srView.bbox[3]) {
                  //console.log("crosses the dateline");
                  worldExtent = [srView.bbox[1], srView.bbox[2], srView.bbox[3] + 360, srView.bbox[0]];
                }
                extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
                newProj.setExtent(extent);
                //console.log("extent:",extent);
              } else {
                //console.log("projection units pole units:",newProj.getUnits());
              }
              let center = getExtentCenter(extent);
              console.log(`extent: ${extent}, center: ${center}`);
              const newView = new View({
                projection: newProj,
                //constrainResolution: true,
                extent: extent || undefined,
                center:center || undefined,
                zoom: srView.default_zoom,
              });
              mapParamsStore.setProjection(newProj.getCode());
              map.setView(newView);
              updateCurrentParms();
              addLayersForCurrentView(); 
              let reqExtremeLatLon = [0,0,0,0];
              if(props.reqId > 0){   
                console.log('calling readOrCacheSummary(',props.reqId,')');  
                const workerSummary = await readOrCacheSummary(props.reqId,'h_mean');
                if(workerSummary){
                  const extremeLatLon = workerSummary.extLatLon;
                  if (extremeLatLon) {
                    reqExtremeLatLon = [
                        extremeLatLon.minLon,
                        extremeLatLon.minLat,
                        extremeLatLon.maxLon,
                        extremeLatLon.maxLat
                    ];
                    //console.log('Using reqId:',props.reqId,' with extent:',extent);
                  } else {
                    console.error("Error: invalid lat-lon data for request:",props.reqId);
                  }
                } else {
                  console.error("Error: invalid workerSummary for request:",props.reqId);
                } 
              } else {
                  console.info("no reqId:",props.reqId);
              }
              //console.log('reqExtremeLatLon:',reqExtremeLatLon);
              extent = applyTransform(reqExtremeLatLon, fromLonLat, undefined, 8);
              //console.log('Using extent:',extent);               
              map.getView().fit(extent, {size: map.getSize(), padding: [10, 10, 10, 10]});
              map.getView().on('change:resolution', onResolutionChange);
              updateCurrentParms();
              updateDeck(map);
              mapStore.setIsLoading();
              try{
                await readAndUpdateElevationData(props.reqId);
              } catch (error) {
                console.error(`Error: readAndUpdateElevationData failed for ${reason}`,error);
                toast.add({severity:'error', summary: 'Error', detail: `Failed to readAndUpdateElevationData for ${reason}`});
              }
              mapStore.resetIsLoading();
            } else {
              console.error("Error: invalid projection bbox:",srView.bbox);
            }
          } else {
            console.error("Error:projection is null");
          }
        } else {
          console.error("Error:projection is null");
        }
      } else {
        console.error("Error:map is null");
      }
      // mapRef.value?.map.getAllLayers().forEach((layer: Layer) => {
      //   console.log(`layer:`,layer.getProperties());
      // });
      //console.log("mapRef.value?.map.getView()",mapRef.value?.map.getView());

    } catch (error) {
      console.error(`Error: updateAnalysisMapView failed for ${reason}`,error);
    }

    console.log(`------ SrAnalysisMap updateAnalysisMapView Done for ${reason} ******`);

  };

  const handleUpdateView = (srView: SrView) => {
    console.log(`handleUpdateView: |${srView.name}|`);
    updateAnalysisMapView("handleUpdateView");
  };

  const handleUpdateBaseLayer = (oldSrLayer: SrLayer) => {
    const newSrLayer = mapParamsStore.getSelectedBaseLayer();
    const oldBaseLayer = getLayer(oldSrLayer.title);
    if(oldBaseLayer){
      if(mapStore.map){
        mapStore.map.removeLayer(oldBaseLayer);
        const newBaseLayer = getLayer(newSrLayer.title);
        let layersCollection = mapStore.map.getLayers();
        layersCollection.insertAt(1, newBaseLayer);
      } else {
        console.log('map not available');
      }    
    } else {
      console.log("Error:handleUpdateBaseLayer srLayer is null");
    }
    console.log(`handleUpdateBaseLayer from |${oldSrLayer.title}| to |${newSrLayer.title}|`);
    updateAnalysisMapView("handleUpdateBaseLayer");
  };

</script>

<template>
  <div class="sr-current-zoom">
    {{  mapParamsStore.getZoom().toFixed(2) }}
  </div>
  <div class="sr-isLoadingEl" v-if="elevationIsLoading" >Loading...{{ func }}
    <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 1rem; height: 1rem"/>
  </div>
  <div class="sr-notLoadingEl" v-else >Loaded {{ func }}</div>
  <div ref="mapContainer" class="sr-map-container" >
    <ol-map ref="mapRef" @error="handleEvent"
      :loadTilesWhileAnimating="true"
      :loadTilesWhileInteracting="true"
      style="height: 30vh; border-radius: 15px; overflow: hidden;"
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

      <ol-zoom-control  />
      
      <ol-mouseposition-control 
        :coordinateFormat="stringifyFunc"
        projection="EPSG:4326"
      />

      <ol-scaleline-control />
      <SrLegendControl @legend-control-created="handleLegendControlCreated" />
      <SrViewControl @view-control-created="handleViewControlCreated" @update-view="handleUpdateView"/>
      <SrBaseLayerControl @baselayer-control-created="handleBaseLayerControlCreated" @update-baselayer="handleUpdateBaseLayer"/>
      <ol-vector-layer title="Drawing Layer" name= 'Drawing Layer' zIndex="999" >
        <ol-source-vector :projection="mapParamsStore.projection">
          <ol-style>
            <ol-style-stroke color="blue" :width="2"></ol-style-stroke>
            <ol-style-fill color="rgba(255, 255, 0, 0.4)"></ol-style-fill>
          </ol-style>
        </ol-source-vector>
        <ol-style>
          <ol-style-stroke color="red" :width="2"></ol-style-stroke>
          <ol-style-fill color="rgba(255,255,255,0.1)"></ol-style-fill>
          <ol-style-circle :radius="7">
            <ol-style-fill color="red"></ol-style-fill>
          </ol-style-circle>
        </ol-style>
      </ol-vector-layer>
      <ol-attribution-control :collapsible="true" :collapsed="true" />
    </ol-map>
    <div class="sr-tooltip-style" id="tooltip"></div>
  </div>
  <div class="current-view-params">
    <SrCurrentMapViewParms v-if="mapParamsStore.getShowCurrentViewDetails()"/>
  </div>

</template>

<style scoped>

.sr-map-container {
  min-height: 15rem;
  min-width: 15rem; 
  width: 100%; 
  border-radius: 
  0.25rem; 
  overflow: hidden;
}
.sr-tooltip-style {
    position: absolute;
    z-index: 10;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 0.3rem;
    border-radius: var(--p-border-radius);
    pointer-events: none;
    font-size: 1rem;
    max-width: 20rem;
}
:deep(.ol-overlaycontainer-stopevent) {
  position: relative;
  display: flex !important;
  flex-direction: column; /* Stack children vertically */
  justify-content: flex-start; /* Align children to the top */
  align-items: flex-end; /* Align children to the right */
  height: 100%; /* Ensure the container has height */
  background-color: var(--white);
  border-radius: 8px;
  padding: 0.25rem;
  border: 1px solid var(--p-primary-color);
}

:deep( .ol-control.ol-layerswitcher ){
  top: 6.25rem;
  bottom: auto;
  left: 0.0rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  border: 1px ;

}

:deep( .ol-control.ol-layerswitcher button ){
  background-color: transparent;
  border-radius: var(--p-border-radius);
}
:deep( .ol-control.ol-layerswitcher > button::before ){
  border-radius: var(--p-border-radius);
}

:deep( .ol-control.ol-layerswitcher > button::after ){
  border-radius: var(--p-border-radius);
}

:deep( .panel-container .ol-layerswitcher-buttons ){
  background-color: transparent;
}
:deep(.layerup.ol-noscroll){
  border-radius: 3px;
  background-color: var(--p-primary-color);
}
:deep(.ol-control.ol-layerswitcher .panel-container){
  background-color: var(--p-primary-100);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
}

/* :deep(.ol-control.ol-layerswitcher .panel-container .ul.panel){
  background-color: red;
  color: red;
  border-radius: var(--p-border-radius);
} */
:deep(.ol-layerswitcher label){
  background-color: transparent;
  color: var(--p-primary-color);
  font-weight: bold;
  font-family: var(--font-family);
  border-radius: var(--p-border-radius);
} 

:deep(.ol-layerswitcher .panel .li-content > label::before){
  border-radius: 2px;
  border-color: var(--p-primary-color);
  border-width: 2px;
} 

/* :deep(.ol-layerswitcher .panel-container .li-content > label::after){
  border-width: 1px;
  background-color: var(--p-primary-color);

}  */
:deep(.panel-container.ol-ext-dialog){
  background-color: transparent;
}

:deep(.ol-ext-dialog .ol-closebox.ol-title){
  color: var(--text-color);
  background-color: var(--p-primary-300);
  font-family: var(--font-family);
  border-radius: var(--p-border-radius);
}

:deep(.ol-geocoder){
  top: 2.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  color: white;
  max-width: 30rem; 
}

:deep(.gcd-gl-control){
  background-color: transparent;
  border-radius: var(--p-border-radius);
}

:deep( .ol-control.sr-view-control ){
  top: 0.55rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  max-width: 30rem; 
}

:deep( .ol-control.sr-base-layer-control ){
  top: 0.55rem;
  bottom: auto;
  right: auto;
  left: 4.5rem;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  color: white;
  max-width: 30rem; 
}

:deep( .ol-control.sr-layers-control ){
  top: 0.55rem;
  bottom: auto;
  right: auto;
  left: 23.5rem;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  color: white;
  max-width: 30rem; 
}
:deep(.ol-ext-dialog .ol-content .ol-wmscapabilities .ol-url .url){
  color: white;
  background-color: var(--p-primary-600);
}

:deep( .ol-control.ol-wmscapabilities  ) {
  top: 4.5rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  padding: 0.125rem;
  border: 1px ;
}
:deep(.ol-wmscapabilities .ol-url button){
  color: white;
  border-radius: var(--p-border-radius);
  background-color: var(--p-primary-400);
}

:deep(.ol-wmscapabilities .ol-url option){
  color: white;
  background-color: var(--p-primary-400);
}

:deep(.ol-zoom){
  top: 0.5rem; 
  right: 0.5rem; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: var(--p-border-radius);
  margin: auto;
  font-size: 1.25rem;
}

:deep(.sr-draw-control){
  top: 5.5rem; 
  right: 0.55rem; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: var(--p-border-radius);
}

:deep(.ol-mouse-position) {
  bottom: 0.5rem; /* Position from the bottom */
  left: 50%; /* Center align horizontally */
  right: auto; /* Reset right positioning */
  top: auto; /* Unset top positioning */
  transform: translateX(-50%); /* Adjust for the element's width */
  color: var(--p-primary-color);
  background: rgba(255, 255, 255, 0.25);
  border-radius: var(--p-border-radius);
}
:deep(.sr-legend-control){
  background: rgba(255, 255, 255, 0.25);
  bottom: 0.5rem;
  right: 2.5rem;
}


:deep(.ol-zoom .ol-zoom-in) {
  margin: 2px;
  border-radius: var(--p-border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}

:deep(.ol-zoom .ol-zoom-out) {
  position: relative;
  margin: 2px;
  border-radius: var(--p-border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}

:deep(.ol-zoom .ol-zoom-out):before {
  content: '';
  position: absolute;
  top: 0px;
  left: 25%; /* Adjust this value to control where the border starts */
  right: 25%; /* Adjust this value to control where the border ends */
  border-top: 1px dashed rgb(200, 200, 200);
}

.sr-current-zoom {
  position: absolute;
  top: 2.25rem;
  right: 1.5rem;
  background-color: transparent;
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
  border-color: white;
  padding: 0.0rem;
  margin-top: 6px;
  margin-bottom: -2px;

  font-size: 0.75rem;
}
.sr-isLoadingEl {
  color: #e91c5a;
  padding: 0.5rem;
  font-size: 1rem;
}
.sr-notLoadingEl {
  color: #4CAF50;
  padding: 0.5rem;
  font-size: 1rem;
}
.hidden-control {
    display: none;
}


</style>