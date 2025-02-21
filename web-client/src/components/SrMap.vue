<script setup lang="ts">
    import { ref, onMounted, onBeforeUnmount, computed } from "vue";
    import { Map as OLMap} from "ol";
    import { useToast } from "primevue/usetoast";
    import { findSrViewKey } from "@/composables/SrViews";
    import { useProjectionNames } from "@/composables/SrProjections";
    import { srProjections } from "@/composables/SrProjections";
    import proj4 from 'proj4';
    import { register } from 'ol/proj/proj4';
    import 'ol-geocoder/dist/ol-geocoder.min.css';
    import { useMapStore } from "@/stores/mapStore";
    import { useGeoCoderStore } from '@/stores/geoCoderStore';
    import { get as getProjection } from 'ol/proj.js';
    import { addLayersForCurrentView } from "@/composables/SrLayers";
    import { Layer as OLlayer } from 'ol/layer';
    import { useWmsCap } from "@/composables/useWmsCap";
    import { Feature as OlFeature } from 'ol';
    import { FeatureLike } from 'ol/Feature';
    import { Polygon as OlPolygon } from 'ol/geom';
    import { DragBox as DragBoxType } from 'ol/interaction';
    import { Draw as DrawType } from 'ol/interaction';
    import { Vector as VectorSource } from 'ol/source';
    import { fromExtent }  from 'ol/geom/Polygon';
    import { Stroke, Style, Fill } from 'ol/style';
    import { clearPolyCoords, drawGeoJson, enableTagDisplay, disableTagDisplay, saveMapZoomState, renderRequestPolygon, canRestoreZoomCenter } from "@/utils/SrMapUtils";
    import { onActivated } from "vue";
    import { onDeactivated } from "vue";
    import { checkAreaOfConvexHullWarning } from "@/utils/SrMapUtils";
    import { toLonLat } from 'ol/proj';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
    import { type Coordinate } from "ol/coordinate";
    import type { SrRegion } from "@/sliderule/icesat2"
    import { format } from 'ol/coordinate';
    import SrViewControl from "./SrViewControl.vue";
    import SrBaseLayerControl from "./SrBaseLayerControl.vue";
    import SrDrawControl from "@/components/SrDrawControl.vue";
    import { Map, MapControls } from "vue3-openlayers";
    import { useRequestsStore } from "@/stores/requestsStore";
    import VectorLayer from "ol/layer/Vector";
    import { useDebugStore } from "@/stores/debugStore";
    import { updateMapView } from "@/utils/SrMapUtils";
    import { renderSvrReqPoly,addFeatureClickListener } from "@/utils/SrMapUtils";
    import router from '@/router/index.js';
    import { useRecTreeStore } from "@/stores/recTreeStore";

    const reqParamsStore = useReqParamsStore();
    const debugStore = useDebugStore();
    const recTreeStore = useRecTreeStore();

    interface SrDrawControlMethods {
        resetPicked: () => void;
    }
    const geoCoderStore = useGeoCoderStore();
    const lonlat_template = 'Latitude:{y}\u00B0, Longitude:{x}\u00B0';
    const meters_template = 'y:{y}m, x:{x}m';
    const stringifyFunc = (coordinate: Coordinate) => {
        const projName = useMapStore().getSrViewObj().projectionName;
        let newProj = getProjection(projName);
        let newCoord = coordinate;
        if(!debugStore.useMetersForMousePosition){
            if(newProj?.getUnits() !== 'degrees'){
                newCoord = toLonLat(coordinate,projName);
                //const polarStereographic = "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";
                //const customProjectedCoordinates = proj4(polarStereographic, "EPSG:4326", coordinate);
                //const customProjectedCoordinates = transform(coordinate, projName, 'EPSG:4326');
                //console.log(`customProjectedCoordinates:\n${customProjectedCoordinates}, newCoord:\n${newCoord}`);
            }
            return format(newCoord, lonlat_template, 4);
        } else {
            return format(coordinate, meters_template, 4);
        }
    };
    const srDrawControlRef = ref<SrDrawControlMethods | null>(null);
    const mapRef = ref<{ map: OLMap }>();
    const mapStore = useMapStore();
    const controls = ref([]);
    const toast = useToast();
    const dragBox = new DragBoxType();
    const drawVectorSource = new VectorSource({wrapX: false});
    const drawVectorLayer = new VectorLayer({
        source: drawVectorSource,
    });

    const recordsVectorSource = new VectorSource({wrapX: false});
    const recordsLayer = new VectorLayer({
        source: recordsVectorSource,
    });
    // Set a custom property, like 'name'
    const drawPolygon = new DrawType({
        source: drawVectorSource,
        type: 'Polygon',
    });

    const handleEvent = (event: any) => {
        console.log(event);
    };
    const computedProjName = computed(() => mapStore.getSrViewObj().projectionName);

    // Function to toggle the DragBox interaction.
    function disableDragBox() {
        //console.log("SrMap disableDragBox");
        // Check if the DragBox interaction is added to the map.
        //console.log("mapRef.value?.map.getInteractions():",mapRef.value?.map.getInteractions());
        mapRef.value?.map.removeInteraction(dragBox);
    }

    function enableDragBox() {
        //console.log("SrMap enableDragBox");
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
        //console.log("dragBox.on boxend");
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
        if((vectorLayer === undefined) || (vectorLayer === null)){
            console.error("dragBox.on boxend Error: Drawing Layer is undefined");
            mapRef.value?.map.addLayer(drawVectorLayer);
        }
        if(!(vectorLayer instanceof OLlayer)){
            console.error("dragBox.on boxend Error: INVALID Drawing Layer?");
            return;
        }
        const vectorSource = vectorLayer.getSource();
        if(vectorSource){
            // Create a rectangle feature using the extent
            let boxFeature = new OlFeature(fromExtent(extent));
            // Apply the style to the feature
            boxFeature.setStyle(boxStyle); 
            //console.log("dragBox.on boxend boxFeature tag:",tag);
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
                console.error("ragBox.on boxend Error:map is null");
            }
            //console.log(`polyCoords:${mapStore.polyCoords}`);
            checkAreaOfConvexHullWarning(); 
            } else {
            console.error("dragBox.on boxend Error:geometry is null?");
            }
        } else {
            console.error("dragBox.on boxend Error:vectorSource is null?");
        }
        disableDragBox();
        disableDrawPolygon();
        if (srDrawControlRef.value) {
            srDrawControlRef.value.resetPicked();
        }
    });

    // Function to toggle the Draw interaction.
    function disableDrawPolygon() {
        //console.log("disableDrawPolygon");
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
        //console.log("enableDrawPolygon");
    }

    drawPolygon.on('drawend', function(event) {
        //console.log("drawend:", event);

        const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');

        if(vectorLayer && vectorLayer instanceof OLlayer){
            const vectorSource = vectorLayer.getSource();
            if(vectorSource){
                // Access the feature that was drawn
                const feature = event.feature;
                feature.setStyle(polygonStyle);
                //console.log("feature:", feature);
                // Get the geometry of the feature
                const geometry = feature.getGeometry() as OlPolygon;
                //console.log("geometry:", geometry);
                // Check if the geometry is a polygon
                if (geometry && geometry.getType() === 'Polygon') {
                    //console.log("geometry:",geometry);
                    // Get the coordinates of all the rings of the polygon
                    const rings = geometry.getCoordinates(); // This retrieves all rings
                    //console.log("Original polyCoords:", rings);

                    const projName = useMapStore().getSrViewObj().projectionName;
                    let thisProj = getProjection(projName);
                    let flatLonLatPairs;
                    if(thisProj?.getUnits() !== 'degrees'){
                        //Convert each ring's coordinates to lon/lat using toLonLat
                        const convertedRings: Coordinate[][] = rings.map((ring: Coordinate[]) =>
                            ring.map(coord => toLonLat(coord) as Coordinate)
                        );
                        //console.log("Converted polyCoords:", convertedRings);
                        mapStore.polyCoords = convertedRings;
                        flatLonLatPairs = convertedRings.flatMap(ring => ring);
                    } else {
                        mapStore.polyCoords = rings;
                        flatLonLatPairs = rings.flatMap(ring => ring);
                    }
                    const srLonLatCoordinates: SrRegion = flatLonLatPairs.map(coord => ({
                        lon: coord[0],
                        lat: coord[1]
                    }));
                    if(isClockwise(srLonLatCoordinates)){
                        //console.log('poly is clockwise, reversing');
                        reqParamsStore.poly = srLonLatCoordinates.reverse();
                    } else {
                        ////console.log('poly is counter-clockwise');
                        reqParamsStore.poly = srLonLatCoordinates;
                    }
                    //console.log('reqParamsStore.poly:',reqParamsStore.poly);

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
                        drawGeoJson('userDrawn',vectorSource, JSON.stringify(geoJson), false, false, tag );
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
        //console.log("Clearing Drawing Layer");
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
                    //console.log("clearDrawingLayer vectorSource has no features:",vectorSource);
                }
            } else {
                console.error("clearDrawingLayer Error:vectorSource is null");
            }
        } else {
            console.log("clearDrawingLayer vectorLayer is null");
        }
        return cleared;
    }

    const handlePickedChanged = async (newPickedValue: string) => {
        //console.log(`handlePickedChanged: ${newPickedValue}`);
        if (newPickedValue === 'Box'){
            if (await useRequestsStore().getNumReqs() < useRequestsStore().helpfulReqAdviceCnt+2) {
                toast.add({ severity: 'info', summary: 'Draw instructions', detail: 'Draw a rectangle by clicking and dragging on the map', life: 5000 });
            }
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
            if (await useRequestsStore().getNumReqs() < useRequestsStore().helpfulReqAdviceCnt+2) {
                toast.add({ severity: 'info', summary: 'Draw instructions', detail: 'Draw a polygon by clicking for each point and returning to the first point', life: 5000 });
            }
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
        //console.log('onAddressChosen:',evt);
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

    function onFeatureClick(featureLike:FeatureLike){
        //console.log('onFeatureClick:',featureLike);
        if (featureLike instanceof OlFeature) {
            const properties = featureLike.getProperties();
            //console.log('Feature properties:',properties);
            if(properties.req_id){
                router.push(`/analyze/${properties.req_id.toString()}`);
            }
        } else {
            console.error('Feature is not an instance of Feature');
        }
    }

    onMounted(async () => {
        //console.log("SrMap onMounted");
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        drawVectorLayer.set('name', 'Drawing Layer');
        recordsLayer.set('name', 'Records Layer');
        recordsLayer.set('title', 'Records Layer');
        Object.values(srProjections.value).forEach(projection => {
            //console.log(`Title: ${projection.title}, Name: ${projection.name} def:${projection.proj4def}`);
            proj4.defs(projection.name, projection.proj4def);
        });
        //console.log("SrMap onMounted registering proj4:",proj4);
        register(proj4);
        if (mapRef.value?.map) {
            //console.log("SrMap onMounted map:",mapRef.value.map);
            mapStore.setMap(mapRef.value.map);
            const map = mapStore.getMap() as OLMap;
            const haveReqPoly = !((reqParamsStore.poly===undefined) || (reqParamsStore.poly === null) || (reqParamsStore.poly.length === 0));
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
                    //console.log("SrMap onMounted adding geocoder");       
                    map.addControl(geocoder);
                    geocoder.on('addresschosen', onAddressChosen); 
                } else {
                    console.error("SrMap Error:geocoder is null?");
                }
                const projectionNames = useProjectionNames();
                projectionNames.value.forEach(name => {
                    const wmsCap = useWmsCap(name);
                    if(wmsCap){ 
                        mapStore.cacheWmsCapForProjection(name, wmsCap);
                    } else {
                        console.error(`SrMap Error: no wmsCap for projection: ${name}`);
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
                mapStore.setCurrentWmsCap(mapStore.getSrViewObj().projectionName);

                //mapStore.setCurrentWmtsCap(mapStore.getProjection());
                // if(mapStore.plink){
                //   const plink = mapStore.plink as any;
                //   map.addControl(plink);
                // }
                await updateThisMapView("SrMap onMounted",canRestoreZoomCenter(map));

                addFeatureClickListener(map,onFeatureClick);
            } else {
                console.error("SrMap Error:map is null");
            } 
            //dumpMapLayers(map, 'SrMap onMounted');
            addRecordPolys();
            if(haveReqPoly){
                //draw and zoom to the current reqParamsStore.poly
                drawCurrentReqPoly();
            }
        } else {
            console.error("SrMap Error:mapRef.value?.map is null");
        }
    });

    // Call saveMapZoomState only when leaving the page
    onBeforeUnmount(() => {
        console.log("SrMap onBeforeUnmount - Saving map zoom state");
        if (mapRef.value?.map) {
            saveMapZoomState(mapRef.value.map);
        } else {
            console.error("SrMap Error: mapRef.value?.map is null on unmount");
        }
    });

    onActivated(() => {
        console.log("SrMap onActivated");
    })

    onDeactivated(() => {
        console.log("SrMap onDeactivated");
    })

    function handleDrawControlCreated(drawControl: any) {
        //console.log(drawControl);
        const map = mapRef.value?.map;
        if(map){
            map.addControl(drawControl);
        } else {
            console.error("Error:map is null");
        }
    };

    function handleViewControlCreated(viewControl: any) {
        //console.log(viewControl);
        const map = mapRef.value?.map;
        if(map){
            //console.log("adding viewControl");
            map.addControl(viewControl);
        } else {
            console.error("Error:map is null");
        }
    };

    function handleBaseLayerControlCreated(baseLayerControl: any) {
        //console.log(baseLayerControl);
        const map = mapRef.value?.map;
        if(map){
            //console.log("adding baseLayerControl");
            map.addControl(baseLayerControl);
        } else {
            console.error("Error:map is null");
        }
    };

    async function addRecordPolys() : Promise<void> {
        const startTime = performance.now(); // Start time
        const reqIds = recTreeStore.allReqIds;
        const map = mapRef.value?.map;
        if(map){
            reqIds.forEach(reqId => {           
                //console.log(`handleUpdateBaseLayer renderSvrReqPoly for ${reqId}`);
                renderSvrReqPoly(map, reqId);
            });
        } else {
            console.error("SrMap addRecordPolys Error:map is null");
        }
        const endTime = performance.now(); // End time
        //console.log('SrMap addRecordPolys for reqIds:',reqIds,` took ${endTime - startTime} ms`);
    }

    function drawCurrentReqPoly(){
        const map = mapRef.value?.map;
        if(map){
            const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
            if(vectorLayer && vectorLayer instanceof OLlayer){
                const vectorSource = vectorLayer.getSource();
                if(vectorSource){
                    if(reqParamsStore.poly){
                        renderRequestPolygon(map, reqParamsStore.poly, 'red');
                    } else {
                        console.error("drawCurrentReqPoly Error:reqParamsStore.poly is null");
                    }
                } else {
                    console.error("drawCurrentReqPoly Error:vectorSource is null");
                }
            } else {
                console.error("drawCurrentReqPoly Error:vectorLayer is null");
            }
        } else {
            console.error("drawCurrentReqPoly Error:map is null");
        }
    }

    const updateThisMapView = async (reason:string, restoreView:boolean=false) => {
        console.log(`****** SrMap updateThisMapView for ${reason} ******`);
        const map = mapRef.value?.map;
        try{
            if(map){
                const srViewObj = mapStore.getSrViewObj();
                const srViewKey = findSrViewKey(mapStore.getSelectedView(),mapStore.getSelectedBaseLayer());
                if(srViewKey.value){
                    await updateMapView(map,srViewKey.value,reason,restoreView);
                    //console.log(`${newProj.getCode()} using our BB:${srViewObj.bbox}`);
                    map.addLayer(drawVectorLayer);
                    map.addLayer(recordsLayer);
                    addLayersForCurrentView(map,srViewObj.projectionName);      
                } else {
                    console.error("SrMap Error: srViewKey is null");
                }
            } else {
                console.error("SrMap Error:map is null");
            };
        } catch (error) {
            console.error(`SrMap Error: updateMapView failed for ${reason}`,error);
        } finally {
            if(map){
                //dumpMapLayers(map,'SrMap updateMapView');
            } else {
                console.error("SrMap Error:map is null");
            }
            //console.log("SrMap mapRef.value?.map.getView()",mapRef.value?.map.getView());
            console.log(`------ SrMap updateMapView Done for ${reason} ------`);
        }
    };


    const handleUpdateSrView = async () => {
        const srViewKey = findSrViewKey(mapStore.getSelectedView(),mapStore.getSelectedBaseLayer());
        if(srViewKey.value){
            console.log(`handleUpdateSrView: |${srViewKey.value}|`);
            const map = mapRef.value?.map;
            try{
                if(map){
                    saveMapZoomState(map);
                    await updateThisMapView("handleUpdateSrView",true);
                } else {
                    console.error("SrMap Error:map is null");
                }
            } catch (error) {
                console.error(`SrMap Error: handleUpdateSrView failed:`,error);
            }
        } else {
            console.error("SrMap Error: srViewKey is null");
        }
    };

    const handleUpdateBaseLayer = async () => {
        const baseLayer = mapStore.getSelectedBaseLayer();
        console.log(`handleUpdateBaseLayer: |${baseLayer}|`);
        const map = mapRef.value?.map;
        try{
            if(map){
                const view = map.getView();
                mapStore.setExtentToRestore(view.calculateExtent(map.getSize()));
                const center = view.getCenter();
                if(center){
                    mapStore.setCenterToRestore(center);
                } else {
                    console.error("SrMap Error: center is null");
                }
                const zoom = view.getZoom();
                if(zoom){
                    mapStore.setZoomToRestore(zoom);
                } else {
                    console.error("SrMap Error: zoom is null");
                }
                saveMapZoomState(map);
                await updateThisMapView("handleUpdateBaseLayer",true);
            } else {
                console.error("SrMap Error:map is null");
            }
        } catch (error) {
            console.error(`SrMap Error: handleUpdateBaseLayer failed:`,error);
        } 
    };

    // Watch for changes in reqIds and handle the logic
    // watch(() => recTreeStore.allReqIds, (newReqIds, oldReqIds) => {
    //     console.log(`SrMap watch reqIds changed from ${oldReqIds} to ${newReqIds}`);
    //     addRecordPolys();
    // },{ deep: true, immediate: true }); // Options to ensure it works for arrays and triggers initially
    
</script>

<template>
<div class="sr-main-map-container">
    <Map.OlMap ref="mapRef" @error="handleEvent"
        :loadTilesWhileAnimating="true"
        :loadTilesWhileInteracting="true"
        :controls="controls"
        class="sr-ol-map"
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
            :projection="computedProjName"
            :coordinateFormat="stringifyFunc as any"
        ></MapControls.OlMousepositionControl>  
        <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />

        <MapControls.OlScalelineControl />
        <SrDrawControl ref="srDrawControlRef" @draw-control-created="handleDrawControlCreated" @picked-changed="handlePickedChanged" />
        <SrViewControl @view-control-created="handleViewControlCreated" @update-view="handleUpdateSrView"/>
        <SrBaseLayerControl @baselayer-control-created="handleBaseLayerControlCreated" @update-baselayer="handleUpdateBaseLayer" />
    </Map.OlMap>
  <div class="sr-tooltip-style" id="tooltip"></div>
</div>
</template>

<style scoped>
:deep(.sr-main-map-container) {
  position: relative;
  height: 100%;
  width: 100%;
  border-radius: 1rem;
  margin: 1rem;
  flex:1 1 auto; /* grow, shrink, basis - let it stretch*/
}

:deep(.sr-ol-map) {
    min-width: 15rem; 
    min-height: 15rem; 
    border-radius: var(--p-border-radius); 
    width: 70vw; 
    height: 88vh; 
    overflow: hidden; 
}

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

:deep( .ol-control.ol-attribution){
    bottom: 0.5rem;
    top: auto;
    left: auto;
    background-color: transparent;
    border-radius: var(--p-border-radius);
    border: 1px;
    border-color: black;
    background-color:  color var(--p-primary-color);
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
  top: 0rem;
  bottom: auto;
  left: 0.5rem;
  right: auto;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  max-width: 30rem; 
}

:deep( .sr-select-menu-default ){
    padding: 0;
}

:deep( .ol-control.sr-baselayer-control ){
  top: 0rem;
  bottom: auto;
  right: auto;
  left: 8.5rem;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  color: white;
  max-width: 30rem; 
}

/* :deep( .ol-control.sr-layers-control ){
  top: 0.55rem;
  bottom: auto;
  right: auto;
  left: 23.5rem;
  background-color: transparent;
  border-radius: var(--p-border-radius);
  color: white;
  max-width: 30rem; 
} */
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