  <script setup lang="ts">
  import { useMapParamsStore } from "@/stores/mapParamsStore";
  import { ref, onMounted } from "vue";
  import { Map as OLMapType} from "ol";
  import { useToast } from "primevue/usetoast";
  import { type SrView } from "@/composables/SrViews";
  import { useProjectionNames } from "@/composables/SrProjections";
  import { srProjections } from "@/composables/SrProjections";
  import proj4 from 'proj4';
  import { register } from 'ol/proj/proj4';
  import 'ol-geocoder/dist/ol-geocoder.min.css';
  import { useMapStore } from "@/stores/mapStore";
  import { useGeoCoderStore } from '@/stores/geoCoderStore';
  import { get as getProjection } from 'ol/proj.js';
  import { getTransform } from 'ol/proj.js';
  import { addLayersForCurrentView,getLayer,getDefaultBaseLayer } from "@/composables/SrLayers";
  import { View } from 'ol';
  import { applyTransform } from 'ol/extent.js';
  import { Layer as OLlayer } from 'ol/layer';
  import { useWmsCap } from "@/composables/useWmsCap";
  import { getDefaultProjection } from '@/composables/SrProjections';
  import { Feature as OlFeature } from 'ol';
  import { Polygon as OlPolygon } from 'ol/geom';
  import { getCenter as getExtentCenter } from 'ol/extent.js';
  import { type SrLayer } from '@/composables/SrLayers';
  import { DragBox as DragBoxType } from 'ol/interaction';
  import { Draw as DrawType } from 'ol/interaction';
  import { Vector as VectorSource } from 'ol/source';
  import { fromExtent }  from 'ol/geom/Polygon';
  import { Stroke, Style, Fill } from 'ol/style';
  import { clearPolyCoords, drawGeoJson, enableTagDisplay, disableTagDisplay } from "@/utils/SrMapUtils";
  import { onActivated } from "vue";
  import { onDeactivated } from "vue";
  import { initDeck,checkAreaOfConvexHullWarning } from "@/utils/SrMapUtils";
  import { toLonLat } from 'ol/proj';
  import { useReqParamsStore } from "@/stores/reqParamsStore";
  import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
  import { type Coordinate } from "ol/coordinate";
  import type { SrRegion } from "@/sliderule/icesat2"
  import { format } from 'ol/coordinate';
  import SrCurrentMapViewParms from "./SrCurrentMapViewParms.vue";
  import SrBaseLayerControl from "./SrBaseLayerControl.vue";
  import SrViewControl from "./SrViewControl.vue";
  import SrLegendControl  from "./SrLegendControl.vue";
  import SrDrawControl from "@/components/SrDrawControl.vue";
  import { Map, MapControls, Layers, Sources } from "vue3-openlayers";

  const reqParamsStore = useReqParamsStore();

  interface SrDrawControlMethods {
    resetPicked: () => void;
  }
  const geoCoderStore = useGeoCoderStore();
  const template = 'Latitude:{y}\u00B0, Longitude:{x}\u00B0';
  const stringifyFunc = (coordinate: Coordinate) => {
    return format(coordinate, template, 4);
  };
  const srDrawControlRef = ref<SrDrawControlMethods | null>(null);
  const mapRef = ref<{ map: OLMapType }>();
  const mapParamsStore = useMapParamsStore();
  const mapStore = useMapStore();
  const controls = ref([]);
  const toast = useToast();
  const dragBox = new DragBoxType();
  const drawPolygon = new DrawType({
    source: new VectorSource({wrapX: false}),
    type: 'Polygon',
  });

  const handleEvent = (event: any) => {
    console.log(event);
  };

  // function onMoveStart(event) {
  //   //console.log("SrMap onMoveStart");
  //   const map = event.map; // Get map from event
  //   map.getTargetElement().style.cursor = 'grabbing'; // Change cursor to grabbing
  // }

  // function onMoveEnd(event) {
  //   //console.log("SrMaponMoveEnd");
  //   const map = event.map; // Get map from event
  //   map.getTargetElement().style.cursor = 'default'; // Reset cursor to default
  // }

  // Function to toggle the DragBox interaction.
  function disableDragBox() {
    console.log("SrMap disableDragBox");
    // Check if the DragBox interaction is added to the map.
    if (mapRef.value?.map.getInteractions().getArray().includes(dragBox)) {
      // If it is, remove it.
      mapRef.value?.map.removeInteraction(dragBox);
    }
  }

  function enableDragBox() {
    console.log("SrMap enableDragBox");
    disableDragBox(); // reset then add
    disableDrawPolygon();
    mapRef.value?.map.addInteraction(dragBox);
  }

  var boxStyle = new Style({
    stroke: new Stroke({
      color: 'red', // Red stroke color
      width: 2, // Stroke width
    }),
    fill: new Fill({
        color: 'rgba(255, 0, 0, 0.1)', // Red fill with 10% opacity
    }),
  });

  var polygonStyle = new Style({
    stroke: new Stroke({
      color: 'Red', // Red stroke color
      width: 2, // Stroke width
    }),
  });

  dragBox.on('boxend', function() {
    console.log("boxend");
    const extent = dragBox.getGeometry().getExtent();
    //console.log("Box extent in map coordinates:", extent);

    // Transform extent to geographic coordinates (longitude and latitude)
    const bottomLeft = toLonLat([extent[0], extent[1]], mapRef.value?.map.getView().getProjection());
    const topRight = toLonLat([extent[2], extent[3]], mapRef.value?.map.getView().getProjection());

    // Calculate topLeft and bottomRight in geographic coordinates
    const topLeft = toLonLat([extent[0], extent[3]], mapRef.value?.map.getView().getProjection());
    const bottomRight = toLonLat([extent[2], extent[1]], mapRef.value?.map.getView().getProjection());

    //console.log(`Bottom-left corner in lon/lat: ${bottomLeft}`);
    //console.log(`Top-left corner in lon/lat: ${topLeft}`);
    //console.log(`Top-right corner in lon/lat: ${topRight}`);
    //console.log(`Bottom-right corner in lon/lat: ${bottomRight}`);

    // Create a region array of coordinates
    const poly = [
      { "lat": topLeft[1], "lon": topLeft[0] },
      { "lat": bottomLeft[1], "lon": bottomLeft[0] },
      { "lat": bottomRight[1], "lon": bottomRight[0] },
      { "lat": topRight[1], "lon": topRight[0] },
      { "lat": topLeft[1], "lon": topLeft[0] } // close the loop by repeating the first point
    ];
    reqParamsStore.poly = poly;
    //console.log("Poly:", poly);
    reqParamsStore.setConvexHull(convexHull(poly));
    const tag = reqParamsStore.getFormattedAreaOfConvexHull();
    //console.log('reqParamsStore.poly:',reqParamsStore.convexHull);

    const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');

    if(vectorLayer && vectorLayer instanceof OLlayer){
      const vectorSource = vectorLayer.getSource();
      if(vectorSource){
        // Create a rectangle feature using the extent
        let boxFeature = new OlFeature(fromExtent(extent));
        // Apply the style to the feature
        boxFeature.setStyle(boxStyle); 
        console.log("boxFeature tag:",tag);
        boxFeature.set('tag',tag);   
        // Add the feature to the vector layer
        vectorSource.addFeature(boxFeature);
        //console.log("boxFeature:",boxFeature);
        // Get the geometry of the feature
        const geometry = boxFeature.getGeometry();
        //console.log("geometry:",geometry);
        if(geometry){
          //console.log("geometry.getType():",geometry.getType());
          // Get the coordinates of the polygon shaped as a rectangle
          mapStore.polyCoords = geometry.getCoordinates();
          if(mapRef.value?.map){
            enableTagDisplay(mapRef.value?.map,vectorSource);
          } else {
            console.error("Error:map is null");
          }
          //console.log(`polyCoords:${mapStore.polyCoords}`);
          checkAreaOfConvexHullWarning(); 
        } else {
          console.error("Error:geometry is null");
        }
      } else {
        console.error("Error:vectorSource is null");
      }
    } else {
      console.error("Error:vectorLayer is null");
    }
    disableDragBox();
    disableDrawPolygon();
    if (srDrawControlRef.value) {
      srDrawControlRef.value.resetPicked();
    }
  });

  // Function to toggle the Draw interaction.
  function disableDrawPolygon() {
    console.log("disableDrawPolygon");
    // Check if the Draw interaction is added to the map.
    if (mapRef.value?.map.getInteractions().getArray().includes(drawPolygon)) {
      // If it is, remove it.
      mapRef.value?.map.removeInteraction(drawPolygon);
    }
  }

  function enableDrawPolygon() {
    disableDragBox();
    disableDrawPolygon(); // reset then add
    mapRef.value?.map.addInteraction(drawPolygon);
    console.log("enableDrawPolygon");
  }

  drawPolygon.on('drawend', function(event) {
    console.log("drawend:", event);

    const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');

    if(vectorLayer && vectorLayer instanceof OLlayer){
      const vectorSource = vectorLayer.getSource();
      if(vectorSource){
        // Access the feature that was drawn
        const feature = event.feature;
        feature.setStyle(polygonStyle);
        vectorSource.addFeature(feature);
        //console.log("feature:", feature);
        // Get the geometry of the feature
        const geometry = feature.getGeometry() as OlPolygon;
        //console.log("geometry:", geometry);
        // Check if the geometry is a polygon
        if (geometry && geometry.getType() === 'Polygon') {
          console.log("geometry:",geometry);
          // Get the coordinates of all the rings of the polygon
          const rings = geometry.getCoordinates(); // This retrieves all rings
          //console.log("Original polyCoords:", rings);

          // Convert each ring's coordinates to lon/lat using toLonLat
          const convertedRings: Coordinate[][] = rings.map((ring: Coordinate[]) =>
            ring.map(coord => toLonLat(coord) as Coordinate)
          );

          mapStore.polyCoords = convertedRings;
          //console.log("Converted mapStore.polyCoords:", mapStore.polyCoords);
          const flatLonLatPairs = convertedRings.flatMap(ring => ring);
          const srLonLatCoordinates: SrRegion = flatLonLatPairs.map(coord => ({
            lon: coord[0],
            lat: coord[1]
          }));
          if(isClockwise(srLonLatCoordinates)){
            //console.log('poly is clockwise, reversing');
            reqParamsStore.poly = srLonLatCoordinates.reverse();
          } else {
            //console.log('poly is counter-clockwise');
            reqParamsStore.poly = srLonLatCoordinates;
          }
          //console.log('srLonLatCoordinates:',srLonLatCoordinates);
          reqParamsStore.setConvexHull(convexHull(srLonLatCoordinates)); // this also poplates the area
          //console.log('reqParamsStore.poly:',reqParamsStore.convexHull);
          // Create GeoJSON from reqParamsStore.convexHull
          const thisConvexHull = reqParamsStore.getConvexHull();
          const tag = reqParamsStore.getFormattedAreaOfConvexHull();
          if(thisConvexHull){
            const geoJson = {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [thisConvexHull.map(coord => [coord.lon, coord.lat])]
              },
              properties: {
                name: "Convex Hull Polygon"
              }
            };
            if(mapRef.value?.map){
              enableTagDisplay(mapRef.value?.map,vectorSource);
            } else {
              console.error("Error:map is null");
            }
            //console.log('GeoJSON:', JSON.stringify(geoJson));
            drawGeoJson(vectorSource, JSON.stringify(geoJson), false, false, tag );
            reqParamsStore.poly = thisConvexHull;
            checkAreaOfConvexHullWarning(); 
          } else {
            console.error("Error:convexHull is null");
          }
        } else {
          console.error("Error: invalid Geometry is not a polygon?:",geometry);
        }
        disableDrawPolygon();
        if (srDrawControlRef.value) {
          srDrawControlRef.value.resetPicked();
        }
      } else {
        console.error("Error:vectorSource is null");
      }
    } else {
      console.error("Error:vectorLayer is null");
    }
  });

  const clearDrawingLayer = () =>{
    console.log("Clearing Drawing Layer");
    disableTagDisplay();
    let cleared = false;
    const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
    if(vectorLayer && vectorLayer instanceof OLlayer){
      const vectorSource = vectorLayer.getSource();
      if(vectorSource){
        const features = vectorSource.getFeatures()
        //console.log("VectorSource hasFeature:",features.length);
        if(features.length > 0){
          //console.log("Clearing VectorSource features");
          vectorSource.clear();
          cleared = true;
        } else {
            console.log("vectorSource has no features:",vectorSource);
        }
      } else {
        console.error("Error:vectorSource is null");
      }
    } else {
      console.error("Error:vectorLayer is null");
    }
    return cleared;
  }

  const handlePickedChanged = (newPickedValue: string) => {
    console.log(`handlePickedChanged: ${newPickedValue}`);

    if (newPickedValue === 'Box'){
      toast.add({ severity: 'info', summary: 'Draw instructions', detail: 'Draw a rectangle by clicking and dragging on the map', life: 5000 });
      disableDragBox();
      disableDrawPolygon();
      clearDrawingLayer();
      clearPolyCoords();
      enableDragBox();
    } else if (newPickedValue === 'Polygon'){
      disableDragBox();
      disableDrawPolygon();
      clearDrawingLayer();
      clearPolyCoords();
      enableDrawPolygon();
      toast.add({ severity: 'info', summary: 'Draw instructions', detail: 'Draw a polygon by clicking for each point and returning to the first point', life: 5000 });
    } else if (newPickedValue === 'TrashCan'){
      disableDragBox();
      disableDrawPolygon();
      clearDrawingLayer();
      clearPolyCoords();
      //console.log("TrashCan selected Clearing Drawing Layer, disabling draw");
    } else if (newPickedValue === ''){ // Reset Picked called and cleared highlight
      disableDragBox();
      disableDrawPolygon();
    } else {
      console.error("unsupported draw type:",newPickedValue);
      toast.add({ severity: 'error', summary: 'Unsupported draw type error', detail: 'Error' });
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
    //console.log("SrMap onMounted");
    //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
    Object.values(srProjections.value).forEach(projection => {
        //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
        proj4.defs(projection.name, projection.proj4def);
    });
    register(proj4);
    if (mapRef.value?.map) {
      console.log("map:",mapRef.value.map);
      mapStore.setMap(mapRef.value.map);
      const map = mapStore.getMap() as OLMapType;
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
          });
        }
        const geocoder = geoCoderStore.getGeoCoder()
        if(geocoder){       
          map.addControl(geocoder);
          geocoder.on('addresschosen', onAddressChosen); 
        } else {
          console.log("Error:geocoder is null?");
        }
        console.log("map.getView():",map.getView());
        // const initialZoom = map.getView().getZoom();
        // if (initialZoom !== undefined) {
        //   mapParamsStore.setZoom(initialZoom);
        // }
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
        // if(mapStore.plink){
        //   const plink = mapStore.plink as any;
        //   map.addControl(plink);
        // }
        updateMapView("onMounted");

      } else {
        console.log("Error:map is null");
      } 
    } else {
      console.log("Error:mapRef.value?.map is null");
    }
  });

  onActivated(() => {
    console.log("SrMap onActivated");
  })

  onDeactivated(() => {
    console.log("SrMap onDeactivated");
  })

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
      //console.log("adding legendControl");
      map.addControl(legendControl);
    } else {
      console.error("Error:map is null");
    }
  };

  const updateMapView = async (reason:string) => {
    //console.log(`****** SrMap updateMapView for ${reason} ******`);
    const map = mapRef.value?.map;
    if(map){
      const srView = mapParamsStore.getSrView();
      let newProj = getProjection('EPSG:4326'); 
      if (newProj ) {

        map.getAllLayers().forEach((layer: OLlayer) => {
          // drawiing Layer is never changed/removed
          if(layer.get('name') !== 'Drawing Layer'){
            //console.log(`removing layer:`,layer.get('title'));
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
            console.error("Error:baseLayer is null");
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
            } else {
              //console.log("projection units pole units:",newProj.getUnits());
            }
            let center = getExtentCenter(extent);
            //console.log(`extent: ${extent}, center: ${center}`);
            const newView = new View({
              projection: newProj,
              //constrainResolution: true,
              extent: extent || undefined,
              center:center || undefined,
              zoom: srView.default_zoom,
            });
            mapParamsStore.setProjection(newProj.getCode());
            map.setView(newView);
            newView.fit(extent);
            //updateCurrentParms();
            addLayersForCurrentView();      
            //map.getView().on('change:resolution', onResolutionChange);
            initDeck(map);
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
    updateMapView("handleUpdateBaseLayer");
  };

</script>

<template>
  <Map.OlMap ref="mapRef" @error="handleEvent"
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    style="height: calc(100vh - 4rem); border-top-left-radius: 1rem; overflow: hidden;"
    :controls="controls"
  >
    <MapControls.OlLayerswitcherControl
      :selection="true"
      :displayInLayerSwitcher="() => true"
      :show_progress="true"
      :mouseover="false"
      :reordering="true"
      :trash="false"
      :extent="true"
    />

    <MapControls.OlZoomControl  />
    
    <MapControls.OlMousepositionControl 
      :coordinateFormat="stringifyFunc as any"
      projection="EPSG:4326"
    />
    <MapControls.OlAttributionControl :collapsible="true" :collapsed="false" />

    <MapControls.OlScalelineControl />
    <SrDrawControl ref="srDrawControlRef" @draw-control-created="handleDrawControlCreated" @picked-changed="handlePickedChanged" />
    <SrLegendControl @legend-control-created="handleLegendControlCreated" />
    <SrViewControl @view-control-created="handleViewControlCreated" @update-view="handleUpdateView"/>
    <SrBaseLayerControl @baselayer-control-created="handleBaseLayerControlCreated" @update-baselayer="handleUpdateBaseLayer"/>
    <Layers.OlVectorLayer title="Drawing Layer" name= 'Drawing Layer' :zIndex=999 >
      <Sources.OlSourceVector :projection="mapParamsStore.projection">
      </Sources.OlSourceVector>
    </Layers.OlVectorLayer>
  </Map.OlMap>
  <div class="sr-tooltip-style" id="tooltip"></div>
  <div class="current-view-params">
    <SrCurrentMapViewParms v-if="mapParamsStore.getShowCurrentViewDetails()"/>
  </div>

</template>

<style scoped>
.sr-tooltip-style {
  position: absolute;
    z-index: 10;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    pointer-events: none;
    font-size: 1rem;
}
:deep(.ol-overlaycontainer-stopevent) {
  position: relative;
  display: flex !important;
  flex-direction: column; /* Stack children vertically */
  justify-content: flex-start; /* Align children to the top */
  align-items: flex-end; /* Align children to the right */
  height: 100%; /* Ensure the container has height */
  background-color: var(--white);
  border: 0;
}

:deep( .ol-control.ol-layerswitcher ){
  top: 2.25rem;
  bottom: auto;
  left: auto;
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
  font-family: var(--p-font-family);
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
  color: var(--p-text-color);
  background-color: var(--p-primary-300);
  font-family: var(--p-font-family);
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
  top: 0.5rem;
  bottom: auto;
  left: auto;
  right: 0.75rem;
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
  top: 6.0rem; 
  left: 0.5rem; 
  right: auto;  
  background-color: black;
  border-radius: var(--p-border-radius);
  margin: auto;
  font-size: 1.25rem;
}

:deep(.sr-draw-control){
  top: 12rem; 
  left: 0.5rem; 
  right: auto;  
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

:deep(.ol-zoom .ol-zoom-in):active {
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
  transform: translateY(2px); /* Slight downward movement to simulate press */
}

:deep(.ol-zoom .ol-zoom-in):hover{
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
}

:deep(.ol-zoom .ol-zoom-out) {
  position: relative;
  margin: 2px;
  border-radius: var(--p-border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-weight: normal;
}

:deep(.ol-zoom .ol-zoom-out):active {
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
  transform: translateY(2px); /* Slight downward movement to simulate press */
}

:deep(.ol-zoom .ol-zoom-out):hover{
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
}

:deep(.ol-zoom .ol-zoom-out):before {
  content: '';
  position: absolute;
  top: 0px;
  left: 25%; /* Adjust this value to control where the border starts */
  right: 25%; /* Adjust this value to control where the border ends */
  border-top: 1px dashed rgb(200, 200, 200);
}



.hidden-control {
    display: none;
}


</style>