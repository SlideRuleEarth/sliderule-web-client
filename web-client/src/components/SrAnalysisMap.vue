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
    import { onActivated } from "vue";
    import { onDeactivated } from "vue";
    import SrLegendControl from './SrLegendControl.vue';
    import { dumpMapLayers, initDeck, zoomMapForReqIdUsingView } from '@/utils/SrMapUtils';
    import { useSrParquetCfgStore } from "@/stores/srParquetCfgStore";
    import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { Map, MapControls, Layers, Sources, Styles } from "vue3-openlayers";
    import { db } from "@/db/SlideRuleDb";
    import { type Coordinate } from "ol/coordinate";
    import { toLonLat } from 'ol/proj';
    import { format } from 'ol/coordinate';
    import { updateMapView } from "@/utils/SrMapUtils";
    
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
    const mapStore = useMapStore();
    const requestsStore = useRequestsStore();
    const controls = ref([]);

    const handleEvent = (event: any) => {
        console.log(event);
    };
    const computedProjName = computed(() => mapStore.getSrViewObj().projectionName);

    const atlChartFilterStore = useAtlChartFilterStore();
    const elevationIsLoading = computed(() => mapStore.getIsLoading());
    const loadStateStr = computed(() => {
        return elevationIsLoading.value ? "Loading" : "Loaded";
    }); 
    const computedFunc = computed(() => atlChartFilterStore.getFunc());

    const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const computedLoadMsg = computed(() => {
        const currentRowsFormatted = numberFormatter.format(mapStore.getCurrentRows());
        const totalRowsFormatted = numberFormatter.format(mapStore.getTotalRows());
        if (mapStore.getCurrentRows() != mapStore.getTotalRows()) {
            return `${loadStateStr.value} ${computedFunc.value} ${currentRowsFormatted} out of ${totalRowsFormatted}`;
        } else {
            return `${loadStateStr.value} ${computedFunc.value} (${currentRowsFormatted})`;
        }
    });

    const props = defineProps({
        reqId: {
            type: Number,
            required: true
        }
    });

    // Watch for changes on reqId
    watch( () => props.reqId, async (newReqId, oldReqId) => {
        console.log(`reqId changed from ${oldReqId} to ${newReqId}`);
        await updateAnalysisMapView("New reqId");  
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

    onMounted(() => {
        console.log("SrAnalysisMap onMounted using reqId:",props.reqId);
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        Object.values(srProjections.value).forEach(projection => {
            //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
            proj4.defs(projection.name, projection.proj4def);
        });
        register(proj4);

        updateAnalysisMapView("onMounted");
        requestsStore.displayHelpfulPlotAdvice("Click on a track in the map to display the elevation scatter plot");
    });

    onActivated(() => {
        console.log("SrAnalysisMap onActivated");
    })

    onDeactivated(() => {
        console.log("SrAnalysisMap onDeactivated");
    })

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
        const map = mapRef.value?.map;
        let srViewName = await db.getSrViewName(props.reqId);
        console.log(`------ SrAnalysisMap updateAnalysisMapView  srViewName:${srViewName}  for ${reason} with reqId:${props.reqId} ------`);

        try {
            if(map){
                await updateMapView(map, srViewName, reason);
                zoomMapForReqIdUsingView(map, props.reqId,srViewName);
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
        console.log(`------ Done SrAnalysisMap updateAnalysisMapView srViewName:${srViewName} for ${reason} with reqId:${props.reqId} ------`);
    };
</script>

<template>
  <div class="sr-isLoadingEl" v-if="elevationIsLoading" >
    <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 1rem; height: 1rem"/>
    {{computedLoadMsg}}
  </div>
  <div class="sr-notLoadingEl" v-else >
    {{ computedLoadMsg }}
  </div>
  <div ref="mapContainer" class="sr-map-container" >
    <Map.OlMap ref="mapRef" @error="handleEvent"
      :loadTilesWhileAnimating="true"
      :loadTilesWhileInteracting="true"
      style="height: 30vh; border-radius: 15px; overflow: hidden;"
      :controls="controls"
    >

      <MapControls.OlZoomControl  />
      
      <MapControls.OlMousepositionControl 
        :projection="computedProjName"
        :coordinateFormat="stringifyFunc as any"
      />

      <MapControls.OlScalelineControl />
      <SrLegendControl @legend-control-created="handleLegendControlCreated" />
      <Layers.OlVectorLayer title="Drawing Layer" name= 'Drawing Layer' :zIndex=999 >
        <Sources.OlSourceVector :projection="computedProjName">
          <Styles.OlStyle>
            <Styles.OlStyleStroke color="blue" :width="2"></Styles.OlStyleStroke>
            <Styles.OlStyleFill color="rgba(255, 255, 0, 0.4)"></Styles.OlStyleFill>
          </Styles.OlStyle>
        </Sources.OlSourceVector>
        <Styles.OlStyle>
          <Styles.OlStyleStroke color="red" :width="2"></Styles.OlStyleStroke>
          <Styles.OlStyleFill color="rgba(255,255,255,0.1)"></Styles.OlStyleFill>
          <Styles.OlStyleCircle :radius="7">
            <Styles.OlStyleFill color="red"></Styles.OlStyleFill>
          </Styles.OlStyleCircle>
        </Styles.OlStyle>
      </Layers.OlVectorLayer>
      <MapControls.OlAttributionControl :collapsible="true" :collapsed="true" />
    </Map.OlMap>
    <div class="sr-tooltip-style" id="tooltip"></div>
  </div>


</template>

<style scoped>

.sr-map-container {
  min-height: 15rem;
  min-width: 15rem; 
  width: 100%; 
  border-radius: var(--p-border-radius); 
  overflow: hidden;
  margin: 0.5rem;
  margin-top: 0;
  padding: 0.5rem;
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
  color: #e9df1c;
  padding-top: 0.5rem;
  margin-bottom: 0rem;
  padding-bottom: 0;
  font-size: 1rem;
}
.sr-notLoadingEl {
  color: #4CAF50;
  padding-top: 0.5rem;
  margin-bottom: 0rem;
  padding-bottom: 0;
  font-size: 1rem;
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