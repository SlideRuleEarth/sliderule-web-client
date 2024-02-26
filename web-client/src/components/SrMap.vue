  <script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore.js";
  import { ref, onMounted } from "vue";
  import type OLMap from "ol/Map.js";
  import {createStringXY} from 'ol/coordinate';
  import SrDrawControl from "@/components/SrDrawControl.vue";
  import {useToast} from "primevue/usetoast";
  import VectorLayer from 'ol/layer/Vector';
  import Geometry from 'ol/geom/Geometry';
  //import SrBaseLayerControl from "./SrBaseLayerControl.vue";
  import SrViewControl from "./SrViewControl.vue";
  import { SrView } from "@/composables/SrViews";
  import { useProjectionNames } from "@/composables/SrProjections";
  import { srProjections } from "@/composables/SrProjections";
  import proj4 from 'proj4';
  import { register } from 'ol/proj/proj4';
  import 'ol/ol.css'; 
  import 'ol-geocoder/dist/ol-geocoder.min.css';
  import { useMapStore } from "@/stores/mapStore";
  import { useGeoCoderStore } from '@/stores/geoCoderStore';
  import { get as getProjection } from 'ol/proj.js';
  import { getTransform } from 'ol/proj.js';
  import { addLayersForCurrentView,getLayer,getDefaultBaseLayer } from "@/composables/SrLayers";
  import View from 'ol/View';
  import { applyTransform } from 'ol/extent.js';
  import Layer from 'ol/layer/Layer';
  import { useWmsCap } from "@/composables/useWmsCap";
  import { getDefaultProjection } from '@/composables/SrProjections';
  import VectorSource from 'ol/source/Vector';
  import Feature from 'ol/Feature';
  import  { getCenter as getExtentCenter } from 'ol/extent.js';
  import { layers }from '@/composables/SrLayers';

  const geoCoderStore = useGeoCoderStore();
  const stringifyFunc = createStringXY(4);

  const mapRef = ref<{ map: OLMap }>();
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
    // Access the feature that was drawn
    const feature = event.feature;

    // Get the geometry of the feature
    const geometry = feature.getGeometry();

    // Check if the geometry is a polygon
    if (geometry.getType() === 'Polygon') {
      // Get the coordinates of the polygon
      const coordinates = geometry.getCoordinates();

      console.log(coordinates);
    }  
  };

  const handlePickedChanged = (newPickedValue: string) => {
    console.log("Draw Picked value changed: " + newPickedValue);
    if (newPickedValue === 'TrashCan'){
      console.log("Clearing Drawing Layer");
      // Access the vector layer's source and clear it
      const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer') as VectorLayer<VectorSource<Feature<Geometry>>>;
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
    console.log(evt);
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
    //console.log("SrMap onMounted");
    //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
    Object.values(srProjections.value).forEach(projection => {
        //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
        proj4.defs(projection.name, projection.proj4def);
    });
    register(proj4);
    if (mapRef.value?.map) {
      mapStore.setMap(mapRef.value?.map);
      const map = mapStore.getMap();
      if(map){
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
        //mapStore.setCurrentWmtsCap(mapParamsStore.getProjection().name);
        if(mapStore.plink){
          const plink = mapStore.plink as any;
          map.addControl(plink);
        }
        updateMapView("onMounted");
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

  // const handleBaseLayerControlCreated = (baseLayerControl: any) => {
  //   //console.log(baseLayerControl);
  //   const map = mapRef.value?.map;
  //   if(map){
  //     //console.log("adding baseLayerControl");
  //     map.addControl(baseLayerControl);
  //   } else {
  //     console.log("Error:map is null");
  //   }
  // };

  const handleViewControlCreated = (viewControl: any) => {
    console.log(viewControl);
    const map = mapRef.value?.map;
    if(map){
      console.log("adding viewControl");
      map.addControl(viewControl);
    } else {
      console.log("Error:map is null");
    }
  };

  const updateMapView = (reason:string) => {
    console.log(`****** updateMapView for ${reason} ******`);
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
            console.log(`skipping layer:`,layer.get('name'));
          }
        });
        let baseLayer = layers.value['Esri World Topo'];

        if(srView.name === 'North'){
          baseLayer = layers.value['Artic Ocean Base'];
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
            console.log('adding Base Layer', baseLayer);
            const layer = getLayer(baseLayer.title);
            map.addLayer(layer);
          } else {
            console.log("Error:baseLayer is null");
          }

          console.log(`${newProj.getCode()} units: ${newProj.getUnits()}`);
          let extent = newProj.getExtent();
          console.log("projection's extent:",extent);
          let worldExtent = newProj.getWorldExtent();
          console.log("projection's World extent:",worldExtent);
          
          const fromLonLat = getTransform('EPSG:4326', newProj);
          console.log("extent:",extent);
          //if(extent == null){ // need to populate from our own data
          console.log(`${newProj.getCode()} using our BB:${srView.bbox}`);
          if (srView.bbox){
            // 5936 is North Alaska; 3413 is North Sea Ice;  3031 is South Pole
            if ((newProj.getCode() == 'EPSG:5936') || (newProj.getCode() == 'EPSG:3031') || (newProj.getCode() == 'EPSG:3413')){
            //if(projection.getUnits() == 'm'){
              console.log("srView.bbox:",srView.bbox);
              let worldExtent = [srView.bbox[1], srView.bbox[2], srView.bbox[3], srView.bbox[0]];
              //projection.setWorldExtent(worldExtent);
              // approximate calculation of projection extent,
              // checking if the world extent crosses the dateline
              if (srView.bbox[1] > srView.bbox[3]) {
                console.log("crosses the dateline");
                worldExtent = [srView.bbox[1], srView.bbox[2], srView.bbox[3] + 360, srView.bbox[0]];
              }
              extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
              //worldExtent = extent;
              newProj.setExtent(extent);
              //newProj.setWorldExtent(worldExtent);
              console.log("worldExtent:",worldExtent);
              console.log("extent:",extent);
            } else {
              console.log("projection units not meters:",newProj.getUnits());
            }
            //} else {
            //  console.log(`${srProjection.name} Extent is NOT NULL using it's extent:${extent}`);
            //}
            let center = getExtentCenter(extent);
            console.log(`extent: ${extent}, center: ${center}`);
            const newView = new View({
              projection: newProj,
              //constrainResolution: true,
              extent: extent || undefined,
              center:center || undefined,
              zoom: srView.default_zoom,
              //minZoom: srView.min_zoom,
              //maxZoom: srView.max_zoom,
            });
            console.log(`new projection code: ${newProj.getCode()}`);
            mapParamsStore.setProjection(newProj.getCode());
            //console.log(`center: ${srProjection.default_center} zoom: ${srProjection.default_zoom} extent: ${extent}`);
            console.log(`newView:`,newView.getProperties());
            map.setView(newView);
            newView.fit(extent);
            updateCurrentParms();
            addLayersForCurrentView();      
            let thisView = map.getView();
            //console.log(`z:${srProjection.default_zoom} view center: ${thisView.getCenter()} default_center:${srProjection.default_center}`);
            thisView.animate({
              center: center, //srProjection.default_center,
              duration: 1000,
              zoom: srView.default_zoom,
            });
            console.log(`z:${srView.default_zoom} view center: ${thisView.getCenter()} center:${center}`);
            console.log(`thisView:`,thisView.getProperties());
            map.getView().on('change:resolution', onResolutionChange);


            // Permalink
            // if(mapStore.plink){
            //   var url = mapStore.plink.getUrlParam('url');
            //   var layerName = mapStore.plink.getUrlParam('layer');
            //   //console.log(`url: ${url} layerName: ${layerName}`);
            //   if (url) {
            //     const currentWmsCapCntrl = mapStore.getWmsCapFromCache(mapStore.currentWmsCapProjectionName );
            //     currentWmsCapCntrl.loadLayer(url, layerName,() => {
            //       // TBD: Actions to perform after the layer is loaded, if any
            //       console.log(`wms Layer loaded from permalink: ${layerName}`);
            //     });
            //   } else {
            //     console.log("No url in permalink");
            //   }
            // }

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
  };

  const handleUpdateView = (srView: SrView) => {
    console.log(`handleUpdateView: |${srView.name}|`);
    updateMapView("handleUpdateView");
  };

  // const handleUpdateBaseLayer = (oldSrLayer: SrLayer) => {
  //   const newSrLayer = mapParamsStore.getSelectedBaseLayer();
  //   const oldBaseLayer = getLayer(oldSrLayer.title);
  //   if(oldBaseLayer){
  //     if(mapStore.map){
  //       mapStore.map.removeLayer(oldBaseLayer);
  //       const newBaseLayer = getLayer(newSrLayer.title);
  //       let layersCollection = mapStore.map.getLayers();
  //       layersCollection.insertAt(1, newBaseLayer);
  //     } else {
  //       console.log('map not available');
  //     }    
  //   } else {
  //     console.log("Error:handleUpdateBaseLayer srLayer is null");
  //   }
  //   console.log(`handleUpdateBaseLayer from |${oldSrLayer.title}| to |${newSrLayer.title}|`);
  //   updateMapView("handleUpdateBaseLayer");
  // };

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

    <ol-zoom-control  />
    
    <ol-mouseposition-control 
      :coordinateFormat="stringifyFunc"
    />

    <ol-scaleline-control />
    <SrDrawControl @drawControlCreated="handleDrawControlCreated" @pickedChanged="handlePickedChanged" />
    <SrViewControl @view-control-created="handleViewControlCreated" @update-view="handleUpdateView"/>
    <!-- <SrBaseLayerControl @baselayer-control-created="handleBaseLayerControlCreated" @update-baselayer="handleUpdateBaseLayer"/> -->
    <ol-vector-layer title="Drawing Layer" name= 'Drawing Layer' zIndex="999" >
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
    <ol-attribution-control :collapsible="true" :collapsed="true" />
  </ol-map>
  <div class="current-view-params">
    <span>currentZoom: {{  mapParamsStore.getZoom() }} </span><br>
    <span>currentCenter: {{  mapParamsStore.getCenter() }}</span><br>
    <span>currentRotation: {{  mapParamsStore.getRotation() }}</span><br>
    <span>currentProjection: {{  mapParamsStore.getProjection()}}</span><br>
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

::v-deep( .ol-control.sr-view-control ){
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
  left: 7.5rem;
  background-color: transparent;
  border-radius: var(--border-radius);
  color: white;
  max-width: 30rem; 
}

::v-deep( .ol-control.sr-layers-control ){
  top: 0.55rem;
  bottom: auto;
  right: auto;
  left: 23.5rem;
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