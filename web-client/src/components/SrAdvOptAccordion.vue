<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import SrMenuInput from './SrMenuInput.vue';
import SrMenuMultiInput from './SrMenuMultiInput.vue';
import SrMultiSelectText from './SrMultiSelectText.vue'
import { useMapStore } from '@/stores/mapStore';
import SrCheckbox from './SrCheckbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrCalendar from './SrCalendar.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrRasterParamsDataTable from './SrRasterParamsDataTable.vue';
import SrFeatherFileUpload from './SrFeatherFileUpload.vue';
import SrRasterParams from './SrRasterParams.vue';
import SrGeoJsonFileUpload from './SrGeoJsonFileUpload.vue';
import SrResources from './SrResources.vue';
import SrYAPC from './SrYAPC.vue';
import SrAtl03Cnf from './SrAtl03Cnf.vue';
import SrAtl08Cnf from './SrAtl08Cnf.vue';
import SrSysConfig from './SrSysConfig.vue';
import SrExtents from './SrExtents.vue';
import SrAncillaryFields from './SrAncillaryFields.vue';
import SrSurfaceElevation from './SrSurfaceElevation.vue';
import SrOutput from './SrOutput.vue';
import SrStorgaeUsage from './SrStorageUsage.vue';
const reqParamsStore = useReqParamsStore();

const mapStore = useMapStore();
//////////////

onUnmounted(() => {

})

watch(mapStore.polygonSource, (newValue) => {
    console.log('polygonSource:', newValue);
    if (newValue.value === 'Draw on Map') {
        console.log('Draw on Map');
    } else if (newValue.value === 'Upload geojson File') {
        console.log('Upload geojson File');
    } else {
        console.error('Unknown polygonSource:', newValue);
    }
});

interface Props {
  title: string;
  ariaTitle: string;
  mission: {name:string,value:string};
  iceSat2SelectedAPI:  {name:string,value:string};
  gediSelectedAPI:  {name:string,value:string};
}

const props = defineProps<Props>();
const polygonSourceItems = ref([{name:'Draw on Map',value:'Draw on Map'},{name:'Upload geojson File',value:'Upload geojson File'}]);
 
onMounted(() => {
    console.log('Mounted SrAdvOptAccordian');
});

</script>

<template>
    <div class="adv-opt-card">
        <div class="adv-opts-wrapper">
            <h4 class="adv-opt-header">{{props.title}} for {{ props.mission.value }}</h4>
            <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
                <AccordionTab header="General" >
                    <SrFeatherFileUpload />
                    <SrMenuInput
                        v-model="mapStore.polygonSource"
                        label = "Polygon Source"
                        aria-label="Select Polygon Source"
                        :menuOptions="polygonSourceItems"
                        tooltipText="This is how you define the region of interest"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#polygons"
                    />
                    <SrGeoJsonFileUpload
                        v-if="mapStore.polygonSource.value==='Upload geojson File'"
                    />
                    <SrSwitchedSliderInput
                        label="Rasterize Polygon cell size"
                        v-model="reqParamsStore.rasterizePolygon"
                        :min="1"
                        :max="100"
                        :decimalPlaces="0"
                        tooltipText="The number of pixels to rasterize the polygon into"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/GeoRaster.html#georaster"
                    />
                    <SrCheckbox
                        label="Ignore Poly for CMR"
                        v-model="reqParamsStore.ignorePolygon"
                        tooltipText="When you check this the server skips the CMR polygon search and uses the resources you specify below"
                        tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/earthdata.html#cmr"
                    />
                    <SrResources v-if="reqParamsStore.ignorePolygon"/>
                    <SrSliderInput
                        v-model="reqParamsStore.totalTimeoutValue"
                        label="Timeout"
                        :min="5"
                        :max="3600"
                        :defaultValue="reqParamsStore.totalTimeoutValue" 
                        :decimalPlaces="0"
                        tooltipText="global timeout setting that sets all timeouts at once (can be overridden by further specifying the other timeouts)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                    />
                    <SrSwitchedSliderInput
                        v-model="reqParamsStore.reqTimeoutValue"
                        label="rqst-timeout"
                        :min="1"
                        :max="3600" 
                        :decimalPlaces="0"
                        tooltipText="total time in seconds for request to be processed"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                    />                    
                    <SrSwitchedSliderInput
                        v-model="reqParamsStore.nodeTimeoutValue"
                        label="node-timeout"
                        :min="1"
                        :max="3600" 
                        :decimalPlaces="0"
                        tooltipText="time in seconds for a single node to work on a distributed request (used for proxied requests)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                    />
                    <SrSwitchedSliderInput
                        v-model="reqParamsStore.readTimeoutValue"
                        label="read-timeout"
                        :min="1"
                        :max="3600" 
                        :decimalPlaces="0"
                        tooltipText="time in seconds for a single read of an asset to take"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                    />
                </AccordionTab>
                <AccordionTab header="Granule Selection" v-if="mission.value==='ICESat-2'" >
                    <SrMenuMultiInput
                        v-model="reqParamsStore.tracks"
                        label = "Track(s)"
                        aria-label="Select Tracks"
                        :menuOptions="reqParamsStore.tracksOptions"
                        :default="reqParamsStore.tracksOptions"
                        tooltipText="Each track has both a weak and a strong spot"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                    />
                    <SrMenuMultiInput
                        v-model="reqParamsStore.beams"
                        label = "Beam(s)"
                        aria-label="Select Beams"
                        :menuOptions="reqParamsStore.beamsOptions"
                        :default="reqParamsStore.beamsOptions"
                        tooltipText="Weak and strong spots are determined by orientation of the satellite"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                    />
                    <SrSwitchedSliderInput
                        v-model="reqParamsStore.rgtValue"
                        label="RGT"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="RGT is the reference ground track: defaults to all if not specified"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.cycleValue"
                        label="Cycle"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.regionValue"
                        label="Region"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="geographic region for corresponding standard product (defaults to all if not specified)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrCalendar
                        v-model="reqParamsStore.t0Value"
                        label="T0"
                        tooltipText="Start Time for filtering granules"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrCalendar
                        v-model="reqParamsStore.t1Value"
                        label="T1"
                        tooltipText="End Time for filtering granules"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    
                </AccordionTab>
                <AccordionTab header="Photon Selection"  v-if="mission.value==='ICESat-2'" >
                    <SrAtl03Cnf />
                    <SrAtl08Cnf />
                    <SrYAPC />
                </AccordionTab>
                <AccordionTab header="Extents" v-if="mission.value==='ICESat-2'" >
                    <SrExtents />
                </AccordionTab>
                <AccordionTab header="Surface Elevation" v-if="mission.value==='ICESat-2' && props.iceSat2SelectedAPI.value==='atl06'"  > 
                    <SrSurfaceElevation />
                </AccordionTab>
                <AccordionTab header="Veg Density Alg" v-if="mission.value==='ICESat-2' && props.iceSat2SelectedAPI.value==='atl08'" >
                    <SrSliderInput
                        v-model="reqParamsStore.binSize"
                        label="Bin Size"
                        :min="0"
                        :max="200"
                        :decimalPlaces="0"
                    />
                    <SrMenuInput
                        v-model="reqParamsStore.geoLocation"
                        label = "Geo Location"
                        aria-label="Select Geo Location"
                        :menuOptions="reqParamsStore.geoLocationOptions"
                    />
                    <SrCheckbox
                        label="Use Absolute Heights"
                        v-model="reqParamsStore.useAbsoluteHeights"
                    />
                    <SrCheckbox
                        label="Send Waveforms"
                        v-model="reqParamsStore.sendWaveforms"
                    />
                    <SrCheckbox
                        label="Use ABoVE Classifier"
                        v-model="reqParamsStore.useABoVEClassifier"   
                    />

                </AccordionTab>
                <AccordionTab header="Ancillary Fields"  v-if="mission.value==='ICESat-2'" >
                    <SrAncillaryFields :iceSat2SelectedAPI="iceSat2SelectedAPI"/>
                </AccordionTab>
                <AccordionTab header="GEDI Footprint"  v-if="mission.value==='GEDI'" >
                    <SrMultiSelectText
                        v-model="reqParamsStore.gediBeams"
                        label = "Select Beam(s)"
                        aria-label="Select Beams"
                        :menuOptions="reqParamsStore.gediBeamsOptions"
                        :default="reqParamsStore.gediBeamsOptions"
                    />
                    <SrCheckbox
                        label="Degrade Flag"
                        v-model="reqParamsStore.degradeFlag"
                    />
                    <SrCheckbox
                        label="L2 Quality Flag"
                        v-model="reqParamsStore.l2QualityFlag"
                    />
                    <SrCheckbox
                        label="L4 Quality Flag"
                        v-model="reqParamsStore.l4QualityFlag"
                    />
                    <SrCheckbox
                        label="Surface Flag"
                        v-model="reqParamsStore.surfaceFlag"
                    />
                </AccordionTab>
                <AccordionTab header="Raster Sampling">
                    <div class="sr-raster-sampling-table-section">
                        <div class="sr-raster-sampling-table-head">
                            <h3>Raster Sampling Parameters Table</h3>
                        </div>  
                        <div class="sr-raster-sampling-table">
                            <SrRasterParamsDataTable  storeNamePrefix="rasterParams"/>
                        </div> 
                    </div>
                    <SrRasterParams />
                </AccordionTab>
                <AccordionTab header="SysConfig">
                    <SrSysConfig />
                </AccordionTab>
                <AccordionTab header="Output">
                    <SrOutput />
                </AccordionTab>
                <AccordionTab header="Debug">
                <SrStorgaeUsage />
                </AccordionTab>
            </Accordion>
        </div>
    </div>
</template>

<style scoped>

.adv-opt-header {
    justify-content: center;
    align-items: center;
}

.adv-opt-card {
    display: flex;
}
.adv-opts-wrapper{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0.1250rem;
    padding: 0.1250rem;

}
.sr-raster-sampling-table-section {
    border-radius: var(--border-radius);
    border: 2px solid var(--surface-d);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    margin: 0.125rem;
    padding: 0.125rem;
}
.sr-raster-sampling-table-head {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.125rem;
    padding: 0.125rem;
}
.sr-raster-sampling-table {
    flex:auto;
    width: 25rem;
    overflow-x: scroll;
    white-space: nowrap;
}

/* 
:deep(.p-accordion .p-accordion-tab) {
    background-color: transparent;
    margin: 0.25rem;
}

:deep(.p-accordion .p-accordion-header) {
    background-color: transparent;
    margin-bottom: 0.0rem;
}

:deep(.p-accordion .p-accordion-tab .p-accordion-header-action) {
    background-color: transparent;
    border-width: 1px;
    margin-bottom: 0rem;
}

:deep(.p-accordion .p-accordion-tab.p-accordion-tab-active) {
    border-color: var(--primary-color);
    border-radius: var(--border-radius);
    border-width: 4px;
    margin-bottom: 0rem;
    color: var(--text-color);
}

:deep(.p-accordion-header.p-highlight){
    background-color: var(--primary-500);
    border-color: var(--primary-color);
    border-radius: var(--border-radius);
    margin-bottom: 0rem;
}
:deep(.p-accordion-header-link.p-accordion-header-action){
    padding:0.5rem;
}

:deep(.p-accordion-content) {
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background-color: transparent;
}

:deep(.p-button.p-component.p-fileupload-choose) {
    font-family: var(--font-family);
    background-color: transparent;
    border-color: var(--primary-100);
    border-width: 1px;
    color: white;
    border-radius: var(--border-radius);
    margin: 0.5rem;
    padding: 0.5rem;
} */

.file-upload-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
}
:deep(.p-progressbar-label){
    color: var(--text-color);
}
.toast-container {
    display: flex;
    padding: 1rem; /* 12px 3rem in bootstrap, adjust accordingly */
    gap: 1rem; /* adjust as needed */
    width: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: var(--border-radius);
}

.upload-icon {
    /* Styles for pi pi-cloud-upload */
    color: var(--primary-color); /* primary-500 color  #2c7be5;*/
    font-size: 1.5rem; /* 2xl size */
}

.message-container {
    display: flex;
    flex-direction: column;
    gap: 1rem; /* adjust as needed */
    width: 100%;
}

.summary, .detail {
    margin: 0;
    font-weight: 600; /* font-semibold */
    font-size: 1rem; /* text-base */
    color: #ffffff;
}

.detail {
    color: var(--text-color); /* text-700 color, adjust as needed */
}

.progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px; /* adjust as needed */
}

.progress-bar {
    height: 4px;
}

.upload-percentage {
    text-align: right;
    font-size: 0.75rem; /* text-xs */
    color:var(--text-color);
}

.button-container {
    display: flex;
    gap: 12px; /* adjust as needed */
    margin-bottom: 12px; /* mb-3, adjust accordingly */
}

 .done-btn {
    padding: 0.25rem 0.5rem; /* py-1 px-2 */
    color: var(--text-color); 
}

</style>