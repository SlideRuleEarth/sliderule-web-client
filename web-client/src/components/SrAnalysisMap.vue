<script setup lang="ts">
    import { useMapStore } from "@/stores/mapStore";
    import { ref, onMounted, watch, computed } from "vue";
    import type OLMap from "ol/Map.js";
    import ProgressSpinner from "primevue/progressspinner";
    import { srProjections } from "@/composables/SrProjections";
    import proj4 from 'proj4';
    import { register } from 'ol/proj/proj4';
    import 'ol/ol.css'; 
    import 'ol-geocoder/dist/ol-geocoder.min.css';
    import { get as getProjection } from 'ol/proj.js';
    import SrLegendControl from '@/components/SrLegendControl.vue';
    import { zoomMapForReqIdUsingView } from '@/utils/SrMapUtils';
    import { useSrParquetCfgStore } from "@/stores/srParquetCfgStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { Map, MapControls } from "vue3-openlayers";
    import { db } from "@/db/SlideRuleDb";
    import { type Coordinate } from "ol/coordinate";
    import { toLonLat } from 'ol/proj';
    import { format } from 'ol/coordinate';
    import { updateMapView, dumpMapLayers, renderSvrReqPoly } from "@/utils/SrMapUtils";
    import SrRecSelectControl from "./SrRecSelectControl.vue";
    import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
    import SrCheckbox from "@/components/SrCheckbox.vue";
    import { getHFieldName } from "@/utils/SrDuckDbUtils";
    import { useRecTreeStore } from "@/stores/recTreeStore";
    import SrColMapSelControl from "./SrColMapSelControl.vue";
    import { useSrToastStore } from "@/stores/srToastStore";
    import { readOrCacheSummary } from "@/utils/SrDuckDbUtils";
    import { Vector as VectorSource } from 'ol/source';
    import VectorLayer from "ol/layer/Vector";
    import { updateMapAndPlot } from "@/utils/SrMapUtils";
    import { useDeckStore } from "@/stores/deckStore"; 
    import SrProgressSpinnerControl from "./SrProgressSpinnerControl.vue"; 
    import { Layer as OLlayer } from 'ol/layer';
    import { Deck } from '@deck.gl/core';
    import { OL_DECK_LAYER_NAME } from '@/types/SrTypes';
    import { useAnalysisMapStore } from "@/stores/analysisMapStore";

    const template = 'Lat:{y}\u00B0, Long:{x}\u00B0';
    const stringifyFunc = (coordinate: Coordinate) => {
        const projName = computedProjName.value;
        let newProj = getProjection(projName);
        let newCoord = coordinate;
        if(newProj?.getUnits() !== 'degrees'){
            newCoord = toLonLat(coordinate,projName);
        }
        return format(newCoord, template, 4);
    };
    const mapContainer = ref<HTMLElement | null>(null);
    const mapRef = ref<{ map: OLMap }>();
    const legendRef = ref<any>();
    const mapStore = useMapStore();
    const requestsStore = useRequestsStore();
    const recTreeStore = useRecTreeStore();
    const deckStore = useDeckStore();
    const srParquetCfgStore = useSrParquetCfgStore();
    const analysisMapStore = useAnalysisMapStore();
    const controls = ref([]);


    const recordsVectorSource = new VectorSource({wrapX: false});
    const recordsLayer = new VectorLayer({
        source: recordsVectorSource,
    });


    const handleEvent = (event: any) => {
        console.log(event);
    };
    const computedProjName = computed(() => mapStore.getSrViewObj().projectionName);
    const elevationIsLoading = computed(() => analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading);
    const loadStateStr = computed(() => {
        return elevationIsLoading.value ? "Loading" : "Loaded";
    }); 
    const computedHFieldName = computed(() => {
        return getHFieldName(recTreeStore.selectedReqId);
    });
    const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const computedLoadMsg = computed(() => {
        const currentRowsFormatted = numberFormatter.format(analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).currentPnts);
        const totalRowsFormatted = numberFormatter.format(analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).totalPnts);
        if (analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).currentPnts != analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).totalPnts) {
            return `${loadStateStr.value} Record:${recTreeStore.selectedReqIdStr} - ${recTreeStore.selectedApi} ${currentRowsFormatted} out of ${totalRowsFormatted} pnts`;
        } else {
            return `${loadStateStr.value} Record:${recTreeStore.selectedReqIdStr} - ${recTreeStore.selectedApi} (${currentRowsFormatted} pnts)`;
        }
    });
    
    const props = withDefaults(
        defineProps<{
            selectedReqId: number;
        }>(),
        {
            selectedReqId: 0,
        }
    );


    // Watch for changes on reqId
    watch( () => props.selectedReqId, async (newReqId, oldReqId) => {
        const msg = `watch props.selectedReqId reqId changed from:  value:${oldReqId} to value:${newReqId}`;
        console.log(msg);
        if(newReqId !== oldReqId){
            if(newReqId > 0){
                await updateAnalysisMapView('watch selectedReqId');
            } else {
                console.error("Error: SrAnalysisMap selectedReqId is 0?");
            }
        }
    });


    // Watch for changes on parquetReader
    watch(() => useSrParquetCfgStore().parquetReader, async (newReader, oldReader) => {
        console.log(`watch parquet reader changed from ${oldReader} to ${newReader}`);
        await updateAnalysisMapView("New parquetReader");
    });

    watch(() => srParquetCfgStore.maxNumPntsToDisplay, async (newMaxNumPntsToDisplay, oldMaxNumPntsToDisplay) => {
        console.log(`watch maxNumPntsToDisplay changed from ${oldMaxNumPntsToDisplay} to ${newMaxNumPntsToDisplay}`);
        await updateAnalysisMapView("New maxNumPntsToDisplay");
    });

    onMounted(async () => {
        console.log("SrAnalysisMap onMounted using selectedReqId:",props.selectedReqId);
        recordsLayer.set('name', 'Records Layer'); // for empty requests need to draw poly in this layer
        recordsLayer.set('title', 'Records Layer');
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        Object.values(srProjections.value).forEach(projection => {
            //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
            proj4.defs(projection.name, projection.proj4def);
        });
        register(proj4);
        const map = mapRef.value?.map;
        if(!map){
            console.error("Error: map is null");
            return;
        }
        await updateAnalysisMapView("onMounted");
        requestsStore.displayHelpfulPlotAdvice("Click on a track in the map to display the elevation scatter plot");
        console.log("SrAnalysisMap onMounted done");
    });

    const handleLegendControlCreated = (legendControl: any) => {
        legendRef.value = legendControl;
        const analysisMap = mapRef.value?.map;
        if(analysisMap){
            console.log("adding legendControl");
            analysisMap.addControl(legendControl);
        } else {
            console.warn("analysisMap is null will be set in onMounted");
        }
    };

    const handleColMapSelControlCreated = (colMapSelControl: any) => {
        const analysisMap = mapRef.value?.map;
        if(analysisMap){
            console.log("adding colMapSelControl");
            analysisMap.addControl(colMapSelControl);
        } else {
            console.error("Error:analysisMap is null");
        }
    };

    function handleRecordSelectorControlCreated(recordSelectorControl: any) {
        //console.log("handleRecordSelectorControlCreated");
        const analysisMap = mapRef.value?.map;
        if(analysisMap){
            //console.log("adding baseLayerControl");
            analysisMap.addControl(recordSelectorControl);
        } else {
            console.error("Error:analysisMap is null");
        }
    };

    const handleProgressSpinnerControlCreated = (progressSpinnerControl: any) => {
        const analysisMap = mapRef.value?.map;
        if (analysisMap) {
            console.log("handleProgressSpinnerControlCreated Adding ProgressSpinnerControl");
            analysisMap.addControl(progressSpinnerControl);
        } else {
            console.warn("handleProgressSpinnerControlCreated analysisMap is null; will be set in onMounted");
        }
    };

    function createDeckInstance(map:OLMap): void{
        //console.log('createDeckInstance');
        const startTime = performance.now(); // Start time
        try{
            const mapView =  map.getView();
            //console.log('mapView:',mapView);
            const mapCenter = mapView.getCenter();
            const mapZoom = mapView.getZoom();
            //console.log('createDeckInstance mapCenter:',mapCenter,' mapZoom:',mapZoom);
            if(mapCenter && mapZoom){
                const tgt = map.getViewport() as HTMLDivElement;
                const deck = new Deck({
                    initialViewState: {longitude:0, latitude:0, zoom: 1},
                    controller: false,
                    parent: tgt,
                    style: {pointerEvents: 'none', zIndex: '1'},
                    layers: [],
                    getCursor: () => 'default',
                    useDevicePixels: false,
                });
                useDeckStore().setDeckInstance(deck);
            } else {
                console.error('createDeckInstance mapCenter or mapZoom is null mapCenter:',mapCenter,' mapZoom:',mapZoom);
            }
        } catch (error) {
            console.error('Error creating DeckGL instance:',error);
        } finally {
            console.log('createDeckInstance end');
        }
        const endTime = performance.now(); // End time
        console.log(`createDeckInstance took ${endTime - startTime} milliseconds. endTime:`,endTime);
    }

    function createOLlayerForDeck(deck:Deck,projectionUnits:string): OLlayer{
        //console.log('createOLlayerForDeck:',name,' projectonUnits:',projectionUnits);  

        const layerOptions = {
            title: OL_DECK_LAYER_NAME,
        }
        const new_layer = new OLlayer({
            render: ({size, viewState}: {size: number[], viewState: {center: number[], zoom: number, rotation: number}})=>{
                //console.log('createOLlayerForDeck render:',name,' size:',size,' viewState:',viewState,' center:',viewState.center,' zoom:',viewState.zoom,' rotation:',viewState.rotation);
                const [width, height] = size;
                //console.log('createOLlayerForDeck render:',name,' size:',size,' viewState:',viewState,' center:',viewState.center,' zoom:',viewState.zoom,' rotation:',viewState.rotation);
                let [longitude, latitude] = viewState.center;
                if(projectionUnits !== 'degrees'){
                    [longitude, latitude] = toLonLat(viewState.center);
                }
                const zoom = viewState.zoom - 1;
                const bearing = (-viewState.rotation * 180) / Math.PI;
                const deckViewState = {bearing, longitude, latitude, zoom};
                deck.setProps({width, height, viewState: deckViewState});
                deck.redraw();
                return document.createElement('div');
            },
            ...layerOptions
        }); 
        return new_layer;  
    }

    function addDeckLayerToMap(map: OLMap){
        //console.log('addDeckLayerToMap:',olLayerName);
        const mapView =  map.getView();
        const projection = mapView.getProjection();
        const projectionUnits = projection.getUnits();
        const updatingLayer = map.getLayers().getArray().find(layer => layer.get('title') === OL_DECK_LAYER_NAME);
        if (updatingLayer) {
            //console.log('addDeckLayerToMap: removeLayer:',updatingLayer);
            map.removeLayer(updatingLayer);
        }
        const deck = deckStore.getDeckInstance();
        const deckLayer = createOLlayerForDeck(deck,projectionUnits);
        if(deckLayer){
            map.addLayer(deckLayer);
            //console.log('addDeckLayerToMap: added deckLayer:',deckLayer,' deckLayer.get(\'title\'):',deckLayer.get('title'));
        } else {
            console.error('No current_layer to add.');
        }
    }

    const updateAnalysisMapView = async (reason:string) => {
        const map = mapRef.value?.map;
        let srViewName = await db.getSrViewName(props.selectedReqId);
        console.log(`------ SrAnalysisMap updateAnalysisMapView  srViewName:${srViewName}  for ${reason} with selectedReqId:`,props.selectedReqId);

        try {
            if(map){
                await updateMapView(map, srViewName, reason, false, props.selectedReqId);
                const summary = await readOrCacheSummary(props.selectedReqId);
                if(!summary){
                    console.error(`Error: No summary for reqId:${props.selectedReqId} srViewName:${srViewName}`);
                    return;
                }
                console.log(`summary.numPoints:${summary.numPoints} srViewName:${srViewName}`);
                const numPointsStr = summary.numPoints; // it is a string BIG INT!
                const numPoints = parseInt(String(numPointsStr));
                if(numPoints > 0){
                    zoomMapForReqIdUsingView(map, props.selectedReqId,srViewName);
                } else {
                    console.warn(`Warn: No points for reqId:${props.selectedReqId} srViewName:${srViewName}`);
                    useSrToastStore().warn('There are no data points in this region', 'Click Request then increase the area of the polygon',10000);
                    map.addLayer(recordsLayer);
                    //dumpMapLayers(map,'SrAnalysisMap');
                    const poly = renderSvrReqPoly(map,props.selectedReqId,"Records Layer",true);
                    //const extent = getSrRegionExtents(poly);
                    //const center = getApproxCenterUsingBounds(extent);
                    //useMapStore().setCenterToRestore(center);

                }
                deckStore.clearDeckInstance(); // Clear any existing instance first
                createDeckInstance(map); 
                addDeckLayerToMap(map);        
                await updateMapAndPlot();

            } else {
                console.error("SrMap Error:map is null");
            }
        } catch (error) {
            console.error(`SrAnalysisMap Error: updateAnalysisMapView failed for ${reason}`,error);
        } finally {
            if(map){
                //dumpMapLayers(map,'SrAnalysisMap');
            } else {
                console.error("SrAnalysisMap Error:map is null");
            }
            console.log("SrAnalysisMap  mapRef.value?.map.getView()",mapRef.value?.map.getView());
            console.log(`------ SrAnalysisMap updateAnalysisMapView Done for ${reason} ------`);
        }
        console.log(`------ Done SrAnalysisMap updateAnalysisMapView srViewName:${srViewName} for ${reason} with selectedReqId:${props.selectedReqId} ------`);
    };
</script>

<template>
<div class="sr-analysis-map-panel">
    <div class="sr-analysis-map-header">
        <div class="sr-isLoadingEl" v-if="elevationIsLoading" >
            <ProgressSpinner v-if="analysisMapStore.getPntDataByReqId(recTreeStore.selectedReqIdStr).isLoading" animationDuration="1.25s" style="width: 1rem; height: 1rem"/>
            {{computedLoadMsg}}
        </div>
        <div class="sr-notLoadingEl" v-else >
            {{ computedLoadMsg }}
        </div>
    </div>
    <div ref="mapContainer" class="sr-map-container" >
        <Map.OlMap 
            ref="mapRef" 
            @error="handleEvent"
            :loadTilesWhileAnimating="true"
            :loadTilesWhileInteracting="true"
            :controls="controls"
            class="sr-ol-analysis-map"
        >

            <MapControls.OlZoomControl  />
            
            <MapControls.OlMousepositionControl 
                :projection="computedProjName"
                :coordinateFormat="stringifyFunc as any"
            />

            <MapControls.OlScalelineControl />

            <SrLegendControl 
                @legend-control-created="handleLegendControlCreated"
                :reqIdStr="recTreeStore.selectedReqIdStr"
                :data_key="computedHFieldName"   
            >
            </SrLegendControl>
            <SrRecSelectControl
                class="sr-record-selector-control" 
                @record-selector-control-created="handleRecordSelectorControlCreated" 
            />
            <SrColMapSelControl
                class="sr-col-menu-sel-control"
                @col-map-sel-control-created="handleColMapSelControlCreated"
            >
            </SrColMapSelControl>
            <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />
            <SrProgressSpinnerControl 
                @progress-spinner-control-created="handleProgressSpinnerControlCreated" 
                v-model="mapRef" 
                :selectedReqId="props.selectedReqId"
            />
        </Map.OlMap>
        <div class="sr-tooltip-style" id="tooltip">
            <SrCustomTooltip 
                ref="tooltipRef"
            />
        </div>
    </div>
    <div class="sr-analysis-map-footer">
        <div>
            <SrCheckbox 
                class="sr-show-hide-tooltip"
                :defaultValue="true"
                label="Show map tooltip"
                labelFontSize="small"
                tooltipText="Show or hide the elevation when hovering mouse over a track"
                v-model="mapStore.showTheTooltip"
                :disabled=elevationIsLoading
                size="small" 
            />
        </div>
        <div>
            <div class="sr-spinner">
                <ProgressSpinner 
                    v-if="elevationIsLoading"
                    class="sr-spinner" 
                    animationDuration=".75s" 
                    style="width: 2rem; 
                    height: 2rem;" 
                    strokeWidth="8" 
                    fill="var(--p-primary-300)"
                />
            </div>
        </div>
    </div>

</div>

</template>

<style scoped>
:deep(.sr-analysis-map-panel) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
  border-radius: 1rem;
  margin: 1rem;
  flex:1 1 auto; /* grow, shrink, basis - let it stretch*/
}
.sr-analysis-map-header {
    display: flex;
    flex-direction: row;
    justify-content:space-around;
    align-items:center;
    width: 100%;
    height: 2rem;
    background: rgba(0, 0, 0, 0.25);
    color: var(--p-primary-color);
    border-radius: var(--p-border-radius);
    font-size: 1rem;
    font-weight: bold;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
}
.sr-analysis-map-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;    /* Center the checkbox horizontally */
  position: relative;         /* Needed for absolute positioning of spinner */
  width: 100%;
  height: 2rem;
  background: rgba(0, 0, 0, 0.25);
  color: var(--p-primary-color);
  border-radius: var(--p-border-radius);
  font-size: 1rem;
  font-weight: bold;
  padding: 0.5rem;
}

/* Absolutely position the spinner on the right */
.sr-analysis-map-footer .sr-spinner {
  position: absolute;
  right: 7rem;
  top: 50%;
  transform: translateY(-50%);
}

.sr-show-hide-tooltip {
    height: 0.5rem;
    margin: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

:deep(.sr-map-container) {
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  margin-top: 0;
  padding: 0.5rem;
  display: flex;
  flex: 1 1 auto;      /* let it stretch in a flex layout */
  width: 100%;
  height: 100%;
  overflow: hidden;    /* if you still want curved corners to clip the child */
}

:deep(.sr-record-selector-control) {
    margin-top:0.25rem;
    margin-left: 0.35rem;
}

/* :deep(.sr-record-selector-control .p-treeselect-sm .p-treeselect-label) {
    font-size: smaller;
    color: black;
    background-color: rgba(255, 255, 255, 0.95);
}


:deep(.sr-record-selector-control .p-treeselect-sm .p-treeselect-dropdown) {
    font-size: smaller;
    color: black;
    background-color: rgba(255, 255, 255, 0.95);
} */

:deep(.sr-ol-analysis-map) {
    min-width: 15rem; 
    min-height: 15rem; 
    border-radius: var(--p-border-radius); 
    width: 45vw; 
    height: 45vh; 
    overflow: hidden; 
    resize:both;
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

.sr-analysis-max-pnts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center; 
    margin-top: 0.5rem;
    min-height: 30%;
    max-height: 30%;
    min-width: 30vw;
    width: 100%;
}

:deep(.ol-mouse-position) {
  top: 0.5rem; /* Position from the top */
  left: 50%; /* Center align horizontally */
  right: auto; /* Reset right positioning */
  bottom: auto; /* Unset bottom positioning */
  transform: translateX(-50%); /* Adjust for the element's width */
  color: var(--p-primary-color);
  background: rgba(255, 255, 255, 0.25);
  border-radius: var(--p-border-radius);
  font-size:smaller;
}

:deep(.sr-legend-control){
  background: rgba(255, 255, 255, 0.25);
  bottom: 0.25rem;
  right: 3.5rem;
}


:deep(.sr-col-menu-sel-control){
    top: auto;
    bottom: 0.25rem;
    right: 15.5rem;
    border-radius: var(--p-border-radius);
}


:deep(.sr-col-menu-sel-control .sr-select-menu-default) {
    font-size: small;
    width: 5rem; 
    margin:0rem;
    padding: 0rem;
    height: 1.75rem;
    color: black; 
    background-color: rgba(255, 255, 255, 0.5);
}

:deep(.sr-menu-input-wrapper){
    margin:0rem;
    padding: 0rem;
}

:deep(.sr-select-menu-item){
    margin:0rem;
    padding: 0rem;
}


:deep(.sr-progress-spinner-control) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
    padding: 1rem;
    border-radius: 50%;
    z-index: 9999;
    pointer-events: none; /* Prevent interaction issues */
}
.sr-isLoadingEl {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #e9df1c;
    padding-top: 0.5rem;
    margin-bottom: 0rem;
    padding-bottom: 0;
    font-size: 1rem;
    align-items: center;
}
.sr-notLoadingEl {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #4CAF50;
    padding-top: 0.5rem;
    margin-bottom: 0rem;
    padding-bottom: 0;
    font-size: 1rem;
    align-items: center;
}
.hidden-control {
    display: none;
}

:deep(.ol-zoom){
  top: 0.5rem; 
  right: 0.75rem; /* right align -- override the default */
  left: auto;  /* Override the default positioning */
  background-color: black;
  border-radius: var(--p-border-radius);
  margin: auto;
  font-size: 0.75rem;
  z-index: 99999;      /* Ensure it stays on top */
}

:deep(.ol-zoom button) {
  width: 1.5rem; /* Smaller button size */
  height: 1.5rem;
}

  :deep(.ol-zoom .ol-zoom-in) ,
  :deep(.ol-zoom .ol-zoom-out) {
  position: relative;
  margin: 1px;
  border-radius: var(--p-border-radius);
  background-color: black;
  color: var(--ol-font-color);
  font-size: 1rem;  /* Reduce text size in buttons */
  font-weight: normal;
}

:deep(.ol-zoom .ol-zoom-out):active {
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
  transform: translateY(2px); /* Slight downward movement to simulate press */
}

:deep(.ol-zoom .ol-zoom-out):hover{
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
}

:deep(.ol-zoom .ol-zoom-in):active {
  background-color:rgba(60, 60, 60, 1); /* Change color on hover */
  transform: translateY(2px); /* Slight downward movement to simulate press */
}

:deep(.ol-zoom .ol-zoom-in):hover{
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

/* recommended by deck.gl for performance reasons */
.overlays canvas {
  mix-blend-mode: multiply;
}

</style>