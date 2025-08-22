<script setup lang="ts">
    import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
    import type OLMap from 'ol/Map.js';
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
    import { Layer } from 'ol/layer';
    import { useWmsCap } from "@/composables/useWmsCap";
    import { Feature } from 'ol';
    import type { FeatureLike } from 'ol/Feature';
    import type Geometry from 'ol/geom/Geometry';
    import { Polygon as OlPolygon } from 'ol/geom';
    import { DragBox as DragBoxType } from 'ol/interaction';
    import { Draw as DrawType } from 'ol/interaction';
    import { Vector as VectorSource } from 'ol/source';
    import { fromExtent }  from 'ol/geom/Polygon';
    import { Stroke, Style, Fill } from 'ol/style';
    import { clearPolyCoords, clearReqGeoJsonData, drawGeoJson, enableTagDisplay, disableTagDisplay, saveMapZoomState, renderRequestPolygon, canRestoreZoomCenter, assignStyleFunctionToPinLayer } from "@/utils/SrMapUtils";
    import { onActivated } from "vue";
    import { onDeactivated } from "vue";
    import type { Ref } from "vue";
    import { checkAreaOfConvexHullWarning,updateSrViewName,renderReqPin } from "@/utils/SrMapUtils";
    import { toLonLat } from 'ol/proj';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { convexHull, isClockwise } from "@/composables/SrTurfUtils";
    import { type Coordinate } from "ol/coordinate";
    import { hullColor, type SrRegion } from '@/types/SrTypes'
    import { format } from 'ol/coordinate';
    import SrViewControl from "./SrViewControl.vue";
    import SrBaseLayerControl from "./SrBaseLayerControl.vue";
    import SrDrawControl from "@/components/SrDrawControl.vue";
    import { Map, MapControls } from "vue3-openlayers";
    import { useRequestsStore } from "@/stores/requestsStore";
    import VectorLayer from "ol/layer/Vector";
    import { useDebugStore } from "@/stores/debugStore";
    import { updateMapView } from "@/utils/SrMapUtils";
    import { renderSvrReqPoly,renderSvrReqRegionMask,zoomOutToFullMap,renderSvrReqPin} from "@/utils/SrMapUtils";
    import router from '@/router/index.js';
    import { useRecTreeStore } from "@/stores/recTreeStore";
    import SrFeatureMenuOverlay from "@/components/SrFeatureMenuOverlay.vue";
    import type { Source } from 'ol/source';
    import type LayerRenderer  from 'ol/renderer/Layer';
    import SrCustomTooltip from "@/components//SrCustomTooltip.vue";
    import SrDropPinControl from "@/components//SrDropPinControl.vue";
    import SrUploadRegionControl from "@/components/SrUploadRegionControl.vue";
    import Point from 'ol/geom/Point';
    import { readShapefileToOlFeatures } from "@/composables/useReadShapefiles";
    import { useGeoJsonStore } from "@/stores/geoJsonStore";
    
    const defaultBathymetryFeatures: Ref<Feature<Geometry>[] | null> = ref(null);
    const showBathymetryFeatures = computed(() => {
        return ((reqParamsStore.missionValue === 'ICESat-2') && (reqParamsStore.iceSat2SelectedAPI === 'atl24x'));
    });
    const defaultBathymetryFeaturesLoaded = ref(false);
    const featureMenuOverlayRef = ref();
    const tooltipRef = ref();
 
    const wasRecordsLayerVisible = ref(false);
    const isDrawing = ref(false);

    function onFeatureMenuSelect(feature: Feature<Geometry>) {
        onFeatureClick([feature]); // Use your existing handler logic
        featureMenuOverlayRef.value.hideMenu();
    }

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
        zIndex: 100,
    });

    const pinVectorSource = new VectorSource({wrapX: false});
    const pinVectorLayer = new VectorLayer({
        source: pinVectorSource,
        zIndex: 100,
    });

    const recordsVectorSource = new VectorSource({wrapX: false});
    const recordsLayer = new VectorLayer({
        source: recordsVectorSource,
        zIndex: 50,
    });

    const uploadedFeaturesVectorSource = new VectorSource({wrapX: false});
    const uploadedFeaturesVectorLayer = new VectorLayer({
        source: uploadedFeaturesVectorSource,
        zIndex: 10,
    });

    const bathymetryFeaturesVectorSource = new VectorSource({wrapX: false});
    const bathymetryFeaturesVectorLayer = new VectorLayer({
        source: bathymetryFeaturesVectorSource,
        zIndex: 10,
    });

    // Set a custom property, like 'name'
    const drawPolygon = new DrawType({
        source: drawVectorSource,
        type: 'Polygon',
        style: new Style({
            stroke: new Stroke({
                color: 'blue',
                width: 2,
            }),
            fill: new Fill({
                color: 'rgba(255, 0, 0, 0.1)', 
            }),
        }),
    });

    const handleEvent = (event: any) => {
        console.log(event);
    };
    const computedProjName = computed(() => mapStore.getSrViewObj().projectionName);

    function getLayerByName(name: string): Layer<Source, LayerRenderer<any>> | undefined {
        const baseLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === name);
        return baseLayer as Layer<Source, LayerRenderer<any>> | undefined;
    }

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
        isDrawing.value = true;
        const map = mapRef.value?.map;
        const records = getLayerByName("Records Layer");

        if (map && records) {
            wasRecordsLayerVisible.value =records.getVisible();
            records.setVisible(false); // Hide the records layer while drawing
        }
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
        isDrawing.value = true;
        const map = mapRef.value?.map;
        const records = getLayerByName("Records Layer");

        if (map && records) {
            wasRecordsLayerVisible.value =records.getVisible();
            records.setVisible(true); // Hide the records layer while drawing
        }
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
        reqParamsStore.setPoly(poly);
        //console.log("Poly:", poly);
        reqParamsStore.setConvexHull(convexHull(poly));
        const tag = reqParamsStore.getFormattedAreaOfConvexHull();
        //console.log('reqParamsStore.poly:',reqParamsStore.convexHull);

        const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
        if((vectorLayer === undefined) || (vectorLayer === null)){
            console.error("dragBox.on boxend Error: Drawing Layer is undefined");
            mapRef.value?.map.addLayer(drawVectorLayer);
        }
        if(!(vectorLayer instanceof Layer)){
            console.error("dragBox.on boxend Error: INVALID Drawing Layer?");
            return;
        }
        const vectorSource = vectorLayer?.getSource();
        if(vectorSource){
            // Create a rectangle feature using the extent
            let boxFeature = new Feature(fromExtent(extent));
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
        isDrawing.value = true;
        const map = mapRef.value?.map;
        const records = getLayerByName("Records Layer");

        if (map && records) {
            wasRecordsLayerVisible.value =records.getVisible();
            records.setVisible(false); // Hide the records layer while drawing
        }
        map?.addInteraction(drawPolygon);
        //console.log("enableDrawPolygon");
    }

    drawPolygon.on('drawend', function(event) {
        //console.log("drawend:", event);
        const map = mapRef.value?.map;

        const vectorLayer = map?.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');

        if(vectorLayer && vectorLayer instanceof Layer){
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
                        reqParamsStore.setPoly(srLonLatCoordinates.reverse());
                    } else {
                        ////console.log('poly is counter-clockwise');
                        reqParamsStore.setPoly(srLonLatCoordinates);
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
                        if(map){
                            enableTagDisplay(map,vectorSource);
                        } else {
                            console.error("Error:map is null");
                        }
                        //console.log('GeoJSON:', JSON.stringify(geoJson));
                        const drawExtent = drawGeoJson('userDrawn',vectorSource, JSON.stringify(geoJson), hullColor, false, tag );
                        if (map && drawExtent) {
                            const [minX, minY, maxX, maxY] = drawExtent;
                            const isZeroArea = minX === maxX || minY === maxY;

                            if (!isZeroArea) {
                                map.getView().fit(drawExtent, {
                                    size: map.getSize(),
                                    padding: [40, 40, 40, 40],
                                });
                            } else {
                                console.warn('Zero-area extent — skipping zoom', drawExtent);
                                zoomOutToFullMap(map);
                            }
                        }
                        //console.log("drawExtent:",drawExtent);
                        //console.log("drawExtent in lon/lat:",drawExtent.map(coord => toLonLat(coord)));
                        //console.log("drawExtent in projName:",drawExtent.map(coord => toLonLat(coord,projName)));
                        //console.log("drawExtent in projName:",drawExtent.map(coord => toLonLat(coord,projName)));
                        //console.log("reqParamsStore.poly:",reqParamsStore.poly);
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
        isDrawing.value = false;
        const records = getLayerByName("Records Layer");
        if (map && records && wasRecordsLayerVisible.value) {
            records.setVisible(true);
        }
    });

    const clearDrawingLayer = () =>{
        //console.log("Clearing Drawing Layer");
        disableTagDisplay();
        let cleared = false;
        const vectorLayer = mapRef.value?.map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
        if(vectorLayer && vectorLayer instanceof Layer){
            const vectorSource = vectorLayer.getSource();
            if(vectorSource){
                const features = vectorSource.getFeatures()
                //console.log("VectorSource hasFeature:",features.length);
                if(features.length > 0){
                    //console.log("Clearing VectorSource features");
                    vectorSource.clear();
                    cleared = true;
                    reqParamsStore.poly = [];
                    reqParamsStore.setConvexHull([]);
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
            clearReqGeoJsonData();
            enableDragBox();
        } else if (newPickedValue === 'Polygon'){
            disableDragBox();
            disableDrawPolygon();
            clearDrawingLayer();
            clearPolyCoords();
            clearReqGeoJsonData();
            enableDrawPolygon();
            if (await useRequestsStore().getNumReqs() < useRequestsStore().helpfulReqAdviceCnt+2) {
                toast.add({ severity: 'info', summary: 'Draw instructions', detail: 'Draw a polygon by clicking for each point and returning to the first point', life: 5000 });
            }
        } else if (newPickedValue === 'TrashCan'){
            disableDragBox();
            disableDrawPolygon();
            clearDrawingLayer();
            clearPolyCoords();
            clearReqGeoJsonData();
            const records = getLayerByName("Records Layer");
            const map = mapRef.value?.map;
            if (map && records && wasRecordsLayerVisible.value) {
                records.setVisible(true);
            }
            //console.log("TrashCan selected Clearing Drawing Layer, disabling draw");
        } else if (newPickedValue === ''){ // Reset Picked called and cleared highlight
            disableDragBox();
            disableDrawPolygon();
            const records = getLayerByName("Records Layer");
            const map = mapRef.value?.map;
            if (map && records && wasRecordsLayerVisible.value) {
                records.setVisible(true);
            }
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

    async function onFeatureClick(features: Feature<Geometry>[]) {
        //console.log('onFeatureClick:', features, coordinate);
        if (features && features.length > 0) {
            const feature = features[0];
            const properties = feature.getProperties();
            //console.log('Feature properties:', properties);
            if (properties.req_id) {
                await router.push(`/analyze/${properties.req_id.toString()}`);
            }
        } else {
            console.error('No features found on click');
        }
    }

    function loadBathymetryFeatures(features: Feature<Geometry>[]) {
        //console.log('loadBathymetryFeatures.length:', features.length);
        const map = mapStore.getMap();
        if(map){
            if(bathymetryFeaturesVectorLayer && bathymetryFeaturesVectorLayer instanceof Layer){
                const vectorSource = bathymetryFeaturesVectorLayer.getSource();
                if(vectorSource){
                    console.log("loadBathymetryFeatures: Adding features to vector source");
                    vectorSource.addFeatures(features);
                    console.log("loadBathymetryFeatures: Features added to vector source");
                }
            } else {
                console.error('loadBathymetryFeatures Error: Vector layer not found or is not a VectorLayer');
                console.trace('Vector layer not found or is not a VectorLayer');
                // Handle the case where the vector layer is not found or is not a VectorLayer
            }
        } else {
            console.error('Map is not defined');
            // Handle the case where the map is not defined
        }
        defaultBathymetryFeaturesLoaded.value = true;
        //console.log("loadBathymetryFeatures defaultBathymetryFeaturesLoaded:",defaultBathymetryFeaturesLoaded.value);
    }

    async function loadDefaultBathymetryFeatures() {
        const bathyFiles = {
            shp: '/shapefiles/ATL24_Mask_v5.shp',
            dbf: '/shapefiles/ATL24_Mask_v5.dbf',
            shx: '/shapefiles/ATL24_Mask_v5.shx'
        };

       

        const { features, warning } = await readShapefileToOlFeatures(bathyFiles);
        defaultBathymetryFeatures.value = features;
        if (warning) {
            toast.add({
                severity: 'warn',
                summary: 'Projection Warning',
                detail: warning,
                life: 8000,
            });
        }
        if (defaultBathymetryFeatures.value?.length) {
            loadBathymetryFeatures(defaultBathymetryFeatures.value);
        } else {
            console.warn("No bathymetry features loaded from static shapefile");
        }
    }

    onMounted(async () => {
        //console.log("SrMap onMounted");
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        if (tooltipRef.value) {
            mapStore.tooltipRef = tooltipRef.value;
        } else {
            console.error('tooltipRef is null on mount');
        }        
        // Wait for the control to be rendered in the DOM
        const button = document.querySelector<HTMLButtonElement>(
            ".ol-control.ol-layerswitcher > button"
        );
        if (button) {
            button.title = "Toggle layer switcher"; // Your tooltip text here
        }
        drawVectorLayer.set('name', 'Drawing Layer');
        drawVectorLayer.set('title', 'Drawing Layer');
        pinVectorLayer.set('name', 'Pin Layer');
        pinVectorLayer.set('title', 'Pin Layer');
        recordsLayer.set('name', 'Records Layer');
        recordsLayer.set('title', 'Records Layer');
        uploadedFeaturesVectorLayer.set('name', 'Uploaded Features');
        uploadedFeaturesVectorLayer.set('title', 'Uploaded Features');
        bathymetryFeaturesVectorLayer.set('name', 'Bathymetry Features');
        bathymetryFeaturesVectorLayer.set('title', 'Bathymetry Features');
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
            const haveReqPin = (reqParamsStore.atl13.coord != null);
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
                await updateReqMapView("SrMap onMounted",canRestoreZoomCenter(map));
                map.getView().on('change:resolution', () => {
                    //const zoom = map.getView().getZoom();
                    //console.log('Current zoom level:', zoom);  // logs the zoom level
                    pinVectorLayer.changed(); // forces pin features to re-evaluate their styles
                });
                map?.on('click', (evt) => {
                    if (isDrawing.value) {
                        featureMenuOverlayRef.value?.hideMenu();
                        return;
                    }
                    const features: Feature<Geometry>[] = [];
                    console.log("SrMap onMounted map click, recordsLayer:",recordsLayer);
                    map.forEachFeatureAtPixel(
                        evt.pixel, 
                        (feature: FeatureLike) => {
                            if (feature instanceof Feature) {
                                features.push(feature as Feature<Geometry>);
                            }
                        },
                        {
                            layerFilter: (layer) => ['Records Layer', 'Pin Layer'].includes(layer.get('name'))
                        }
                    );

                    const pointerEvent = evt.originalEvent as MouseEvent;
                    if (features.length && pointerEvent) {
                        featureMenuOverlayRef.value?.showMenu(pointerEvent.clientX, pointerEvent.clientY, features);
                    } else {
                        featureMenuOverlayRef.value?.hideMenu();
                    }
                });
            } else {
                console.error("SrMap Error:map is null");
            } 
            //dumpMapLayers(map, 'SrMap onMounted');
            addRecordLayer();
            if(haveReqPoly || haveReqPin){
                //draw and zoom to the current reqParamsStore.poly
                drawCurrentReqPolyAndPin();
            }
        } else {
            console.error("SrMap Error:mapRef.value?.map is null");
        }
        mapRef.value?.map.getLayers().forEach((layer, idx) => {
            const name = layer.get('name') || `Unnamed Layer ${idx}`;
            const z = layer.getZIndex?.() ?? '(no z-index)';
            console.log(`${name}: Z-Index = ${z}`);
        });
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
            console.error("handleDrawControlCreated Error:map is null");
        }
    };

    function handlePinDropControlCreated(pinDropControl: any) {
        //console.log(drawControl);
        const map = mapRef.value?.map;
        if(map){
            map.addControl(pinDropControl);
        } else {
            console.error("handlePinDropControlCreated Error:map is null");
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

    function handleUploadRegionControlCreated(uploadControl: any) {
    const map = mapRef.value?.map;
    if (map) {
        map.addControl(uploadControl);
    } else {
        console.error("handleUploadRegionControlCreated Error: map is null");
    }
    }

    async function addRecordLayer() : Promise<void> {
        const startTime = performance.now(); // Start time
        const reqIds = recTreeStore.allReqIds;
        const map = mapRef.value?.map;
        if(map){
            assignStyleFunctionToPinLayer(map, useMapStore().getMinZoomToShowPin());
            reqIds.forEach(async reqId => {    
                const api = recTreeStore.findApiForReqId(reqId);
                if(api.includes('atl13')){
                    renderSvrReqPin(map,reqId);
                }
                renderSvrReqPoly(map, reqId);
                renderSvrReqRegionMask(map, reqId);
            });
        } else {
            console.warn("addRecordLayer SrMap skipping addRecordLayer when map is null");
        }
        const endTime = performance.now(); // End time
        console.log('SrMap addRecordLayer for reqIds.length:',reqIds.length,` took ${endTime - startTime} ms`);
    }

    function drawCurrentReqPolyAndPin() {
        const map = mapRef.value?.map;
        if(map){
            const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Drawing Layer');
            if(vectorLayer && vectorLayer instanceof Layer){
                const vectorSource = vectorLayer.getSource();
                if(vectorSource){
                    if(reqParamsStore.poly){
                        renderRequestPolygon(map, reqParamsStore.poly, 'red');
                    } 
                    // check and see if pinCoordinate is defined
                    if(reqParamsStore.useAtl13Point){
                        if(reqParamsStore.atl13.coord){
                            renderReqPin(map,reqParamsStore.atl13.coord);
                        }
                    }
                    const reqGeoJsonData = useGeoJsonStore().getReqGeoJsonData();
                    if(reqGeoJsonData){
                        //console.log("drawCurrentReqPolyAndPin drawing reqGeoJsonData:",geoJsonData);
                        drawGeoJson('reqGeoJson',vectorSource, reqGeoJsonData, 'red', true);
                    }

                } else {
                    console.error("drawCurrentReqPolyAndPin Error:vectorSource is null");
                }
            } else {
                console.error("drawCurrentReqPolyAndPin Error:vectorLayer is null");
            }
        } else {
            console.error("drawCurrentReqPolyAndPin Error:map is null");
        }
    }

    const updateReqMapView = async (reason:string, restoreView:boolean=false) => {
        console.log(`****** SrMap updateReqMapView for ${reason} ******`);
        const map = mapRef.value?.map;
        try{
            if(map){
                const srViewObj = mapStore.getSrViewObj();
                const srViewKey = findSrViewKey(mapStore.getSelectedView(),mapStore.getSelectedBaseLayer());
                if(srViewKey.value){
                    await updateMapView(map,srViewKey.value,reason,restoreView);
                    map.addLayer(drawVectorLayer);
                    map.addLayer(pinVectorLayer);
                    map.addLayer(recordsLayer);
                    map.addLayer(uploadedFeaturesVectorLayer);
                    map.addLayer(bathymetryFeaturesVectorLayer);
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
                    await updateReqMapView("handleUpdateSrView",true);
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
        const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer);
        if(srViewKey.value){
            await updateSrViewName(srViewKey.value); // Update the SrViewName in the DB based on the current selection
        } else {
            console.error("SrMap Error: srViewKey is null, can't update base layer");
            return;
        }
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
                await updateReqMapView("handleUpdateBaseLayer",true);
            } else {
                console.error("SrMap Error:map is null");
            }
        } catch (error) {
            console.error(`SrMap Error: handleUpdateBaseLayer failed:`,error);
        } 
    };

    // Watch for changes in reqIds and handle the logic
    watch(() => recTreeStore.allReqIds, (newReqIds, oldReqIds) => {
        console.log(`SrMap watch num reqIds changed from ${oldReqIds?.length} to ${newReqIds.length}`);
        addRecordLayer();
    },{ deep: true, immediate: true }); // Options to ensure it works for arrays and triggers initially
    
    let dropPinClickListener: ((evt: any) => void) | null = null;


    watch(() => reqParamsStore.iceSat2SelectedAPI, (newValue, oldValue) => {
        console.log(`SrMap watch reqParamsStore.iceSat2SelectedAPI changed from ${oldValue} to ${newValue}`);
        if(newValue === 'atl13x'){
          //console.log("ICESat-2 Inland Bodies of Water selected.");
          clearDrawingLayer();
          clearPolyCoords();
        } else {
            mapStore.dropPinEnabled = false;
            // 🔴 Remove dropped pin
            reqParamsStore.removePin();
            reqParamsStore.useAtl13RefId = false;
            console.log("Dropped pin removed due to api change");
        }
    });

    watch(() => mapStore.dropPinEnabled, (newValue, oldValue) => {
        //console.log(`SrMap watch reqParamsStore.dropPinEnabled changed from ${oldValue} to ${newValue}`);
        const map = mapRef.value?.map;
        if (!map) {
            console.error("Map is not available in dropPinEnabled watcher");
            return;
        }

        const targetElement = map.getTargetElement();

        if (newValue) {
            recordsLayer.setVisible(false); // Hide records layer while dropping pin
            targetElement.style.cursor = 'crosshair';
            dropPinClickListener = function (evt) {
                const coordinate = evt.coordinate;
                reqParamsStore.dropPin(toLonLat(coordinate, map.getView().getProjection()));

                // Clear previous pin(s)
                pinVectorSource.clear();

                // Create new pin feature
                const pointFeature = new Feature({
                    geometry: new Point(coordinate),
                    name: "Dropped Pin",
                });

                pinVectorSource.addFeature(pointFeature);

                // --- Zoom logic here ---
                const minZoom = mapStore.getMinZoomToShowPin();
                const view = map.getView();
                const currentZoom = view.getZoom();
                if (currentZoom) {
                    if (currentZoom < minZoom) {
                        view.animate({ center: coordinate,zoom: minZoom, duration: 250 });
                    } else {
                        // If already at or above minZoom, just center the view
                        view.animate({ center: coordinate, duration: 250 });
                    }
                } else {
                    console.error("Current zoom level is null, cannot animate view");
                }

                map.getTargetElement().style.cursor = '';
                map.un('click', dropPinClickListener!);
                dropPinClickListener = null;
                mapStore.dropPinEnabled = false;
            };

            map.on('click', dropPinClickListener);
        } else {
            recordsLayer.setVisible(true); // Show records layer when not dropping pin
            targetElement.style.cursor = '';
            if (dropPinClickListener) {
                map.un('click', dropPinClickListener);
                dropPinClickListener = null;
            }
        }
    });
    watch(() => reqParamsStore.atl13.coord, (newValue, oldValue) => {
        console.log(`SrMap watch reqParamsStore.atl13.coord changed from ${oldValue} to ${newValue}`);
        if(newValue === null){
            // Remove the pin from map
            pinVectorSource.clear();  
        }
    });
    watch(showBathymetryFeatures, (newValue) => {
        //console.log(`SrMap watch showBathymetryFeatures changed to ${newValue} defaultBathymetryFeaturesLoaded: ${defaultBathymetryFeaturesLoaded.value}`);
        if(defaultBathymetryFeaturesLoaded.value === false){
            loadDefaultBathymetryFeatures();
        }
        if (newValue) {
            // Show bathymetry features
            bathymetryFeaturesVectorLayer.setVisible(true);
        } else {
            // Hide bathymetry features
            bathymetryFeaturesVectorLayer.setVisible(false);
        }
    });

</script>

<template>
<div>
    <div class="sr-main-map-container">
        <div id="map-center-highlight"/>
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
            <SrDrawControl 
                ref="srDrawControlRef" 
                v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x' || reqParamsStore.useAtl13Polygon" 
                @draw-control-created="handleDrawControlCreated" 
                @picked-changed="handlePickedChanged" 
            />
            <SrViewControl @view-control-created="handleViewControlCreated" @update-view="handleUpdateSrView"/>
            <SrBaseLayerControl @baselayer-control-created="handleBaseLayerControlCreated" @update-baselayer="handleUpdateBaseLayer" />
            <SrDropPinControl v-if="reqParamsStore.iceSat2SelectedAPI==='atl13x'" @drop-pin-control-created="handlePinDropControlCreated"/>
            <SrUploadRegionControl
                v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x'"
                :reportUploadProgress="true"
                :loadReqPoly="true"
                corner="top-left"
                :offsetX="'0.5rem'"
                :offsetY="'19rem'"
                @upload-region-control-created="handleUploadRegionControlCreated"
            />
            <SrUploadRegionControl
                v-if="reqParamsStore.iceSat2SelectedAPI != 'atl13x'"
                :reportUploadProgress="true"
                :loadReqPoly="false"
                corner="top-right"
                :offsetX="'0.5rem'"
                :offsetY="'2.5rem'"
                bg="rgba(255,255,255,0.6)" 
                color="black"
                @upload-region-control-created="handleUploadRegionControlCreated"
            />

        </Map.OlMap>

    </div>    
    <SrCustomTooltip ref="tooltipRef" id="MainMapTooltip" />
    <SrFeatureMenuOverlay ref="featureMenuOverlayRef" @select="onFeatureMenuSelect" />        
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
  top: 5rem;
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
/* Size the launcher square */
:deep(.ol-control.ol-layerswitcher > button) {
  width: 2.0rem;           /* your target box */
  height: 2.0rem;
  padding: 0;               /* remove inner padding */
  background: transparent;
  display: grid;            /* perfectly center the icon */
  place-items: center;
  line-height: 1;           /* don't shrink the icon */
  font-size: 1.4rem;        /* <— grows the icon (base for ::before/::after) */
}

/* Make the glyphs use more of the box */
:deep(.ol-control.ol-layerswitcher > button::before),
:deep(.ol-control.ol-layerswitcher > button::after) {
    margin: 0;                   /* reset any theme offsets */
    line-height: 1;
}


/* 2) Panel width */
:deep(.ol-control.ol-layerswitcher .panel-container) {
  width: 22rem;            /* <- change me */
  max-width: 90vw;
}

/* 3) Panel max height + scrolling */
:deep(.ol-control.ol-layerswitcher .panel) {
  max-height: 55vh;        /* <- change me */
  overflow: auto;
}

/* Optional: compact list items & checkbox hit-box */
:deep(.ol-layerswitcher .panel .li-content) {
  padding: 0.25rem 0.5rem;
}
:deep(.ol-layerswitcher .panel .li-content > label) {
  font-size: 0.95rem;      /* text size */
}
:deep(.ol-layerswitcher .panel .li-content > label::before) {
  width: 0.95rem; height: 0.95rem; /* checkbox size */
}

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

:deep(.sr-drop-pin-control){
  top: 20rem; 
  left: 0.5rem; 
  right: auto;  
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

.ol-marker-label {
    background: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: #333;
    white-space: nowrap;
    border: 1px solid #ccc;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    pointer-events: none;
}

/* SrMap.vue (scoped with :deep) or a global stylesheet */
:deep(.ol-control.sr-upload-region-control) {
  position: absolute;
  top: var(--sr-top, auto);
  right: var(--sr-right, auto);
  bottom: var(--sr-bottom, auto);
  left: var(--sr-left, auto);

  background-color: var(--sr-bg, black);
  color: var(--sr-color, var(--ol-font-color));
  border-radius: var(--sr-radius, var(--p-border-radius));

  /* Whatever defaults you want: padding, shadow, etc. */
  padding: 0.25rem;
}




</style>