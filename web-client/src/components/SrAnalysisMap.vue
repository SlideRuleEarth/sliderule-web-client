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
    import { initDeck, zoomMapForReqIdUsingView } from '@/utils/SrMapUtils';
    import { useSrParquetCfgStore } from "@/stores/srParquetCfgStore";
    import { useChartStore } from "@/stores/chartStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { Map, MapControls } from "vue3-openlayers";
    import { db } from "@/db/SlideRuleDb";
    import { type Coordinate } from "ol/coordinate";
    import { toLonLat } from 'ol/proj';
    import { format } from 'ol/coordinate';
    import { updateMapView,dumpMapLayers } from "@/utils/SrMapUtils";
    import SrRecSelectControl from "./SrRecSelectControl.vue";
    import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
    import SrCheckbox from "@/components/SrCheckbox.vue";
    import { getHFieldName } from "@/utils/SrDuckDbUtils";
    import { useRecTreeStore } from "@/stores/recTreeStore";


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
    const chartStore = useChartStore();
    const requestsStore = useRequestsStore();
    const recTreeStore = useRecTreeStore();
    const controls = ref([]);

    const handleEvent = (event: any) => {
        console.log(event);
    };
    const computedProjName = computed(() => mapStore.getSrViewObj().projectionName);

    const elevationIsLoading = computed(() => mapStore.getIsLoading());
    const loadStateStr = computed(() => {
        return elevationIsLoading.value ? "Loading" : "Loaded";
    }); 
    const computedHFieldName = computed(() => {
        return getHFieldName(recTreeStore.selectedReqId);
    });
    const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const computedLoadMsg = computed(() => {
        const currentRowsFormatted = numberFormatter.format(mapStore.getCurrentRows());
        const totalRowsFormatted = numberFormatter.format(mapStore.getTotalRows());
        if (mapStore.getCurrentRows() != mapStore.getTotalRows()) {
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
        const msg = `props.selectedReqId reqId changed from:  value:${oldReqId} to value:${newReqId}`;
        console.log(msg);
        if(newReqId !== oldReqId){
            if(newReqId > 0){
                await updateAnalysisMapView(msg);
            } else {
                console.error("Error: SrAnalysisMap selectedReqId is 0?");
            }
        }
    });


    // Watch for changes on parquetReader
    watch(() => useSrParquetCfgStore().parquetReader, async (newReader, oldReader) => {
        console.log(`parquet reader changed from ${oldReader} to ${newReader}`);
        await updateAnalysisMapView("New parquetReader");
    });

    watch(() => useSrParquetCfgStore().maxNumPntsToDisplay, async (newMaxNumPntsToDisplay, oldMaxNumPntsToDisplay) => {
        console.log(`maxNumPntsToDisplay changed from ${oldMaxNumPntsToDisplay} to ${newMaxNumPntsToDisplay}`);
        await updateAnalysisMapView("New maxNumPntsToDisplay");
    });

    onMounted(async () => {
        console.log("SrAnalysisMap onMounted using selectedReqId:",props.selectedReqId);
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        Object.values(srProjections.value).forEach(projection => {
            //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
            proj4.defs(projection.name, projection.proj4def);
        });
        register(proj4);

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

    const updateAnalysisMapView = async (reason:string) => {
        const map = mapRef.value?.map;
        let srViewName = await db.getSrViewName(props.selectedReqId);
        console.log(`------ SrAnalysisMap updateAnalysisMapView  srViewName:${srViewName}  for ${reason} with selectedReqId:`,props.selectedReqId);

        try {
            if(map){
                await updateMapView(map, srViewName, reason);
                zoomMapForReqIdUsingView(map, props.selectedReqId,srViewName);
                initDeck(map);
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
            <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 1rem; height: 1rem"/>
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
            class="sr-ol-map"
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
            <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />
        </Map.OlMap>
        <div class="sr-tooltip-style" id="tooltip">
            <SrCustomTooltip 
                ref="tooltipRef"
            />
        </div>
    </div>
    <div>
        <SrCheckbox 
            class="sr-show-hide-tooltip"
            :defaultValue="true"
            label="Show map tooltip"
            labelFontSize="small"
            tooltipText="Show or hide the elevation when hovering mouse over a track"
            v-model="mapStore.showTheTooltip"
            :disabled="useMapStore().isLoading"
            size="small" 
        />            
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
    margin-left: 0.25rem;
    font-size:smaller;
}

:deep(.sr-select-menu-default) {
    padding: 0rem; 
    font-size: small;
    width: 8rem; 
    height: 2.25rem; 
}

:deep(.sr-ol-map) {
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
  bottom: 0.5rem;
  right: 2.5rem;
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



</style>