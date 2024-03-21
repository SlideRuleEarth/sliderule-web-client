

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import SrMenuInput from './SrMenuInput.vue';
import SrMenuMultiInput from './SrMenuMultiInput.vue';
import SrMultiSelect from './SrMultiSelect.vue'
import SrCredsFileUpload from './SrCredsFileUpload.vue';
import { useMapStore } from '@/stores/mapStore';
import SrCheckbox from './SrCheckbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrCalendar from './SrCalendar.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrRasterParamsDataTable from './SrRasterParamsDataTable.vue';
import SrRasterParams from './SrRasterParams.vue';
import SrGeoJsonFileUpload from './SrGeoJsonFileUpload.vue';
import SrTextInput from './SrTextInput.vue';

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
const polygonSourceItems = ref([{name:'Polygon Source',value:'Draw on Map'},{name:'Polygon Source',value:'Upload geojson File'}]);
 
onMounted(() => {
    console.log('Mounted SrAdvOptAccordian');
});

</script>

<template>
    <div class="adv-opt-card">
        <div adv-opts-wrapper>
            <h4 class="adv-opt-header">{{props.title}} for {{ props.mission.value }}</h4>
            <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
                <AccordionTab header="General" >
                    <SrMenuInput
                        v-model="mapStore.polygonSource"
                        label = "Polygon Source:"
                        aria-label="Select Polygon Source"
                        :menuOptions="polygonSourceItems"
                    />
                    <SrGeoJsonFileUpload
                        v-if="mapStore.polygonSource.value==='Upload geojson File'"
                    />
                    <SrCheckbox
                        label="Rasterize Polygon:"
                        v-model="reqParamsStore.rasterizePolygon"
                    />
                    <SrCheckbox
                        label="Ignore Poly for CMR:"
                        v-model="reqParamsStore.ignorePolygon"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.reqTimeoutValue"
                        label="Req timeout:"
                        :min="5"
                        :max="3600" 
                        :decimal-places="0"
                    />
                </AccordionTab>
                <AccordionTab header="Granule Selection" v-if="mission.value==='ICESat-2'" >
                    <SrMenuMultiInput
                        v-model="reqParamsStore.tracks"
                        label = "Track(s):"
                        aria-label="Select Tracks"
                        :menuOptions="reqParamsStore.tracksOptions"
                        :default="reqParamsStore.tracksOptions"
                    />
                    <SrMenuMultiInput
                        v-model="reqParamsStore.beams"
                        label = "Beam(s):"
                        aria-label="Select Beams"
                        :menuOptions="reqParamsStore.beamsOptions"
                        :default="reqParamsStore.beamsOptions"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.rgtValue"
                        label="RGT:"
                        :min="1"
                        :max="100" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.cycleValue"
                        label="Cycle:"
                        :min="1"
                        :max="100" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.regionValue"
                        label="Region:"
                        :min="1"
                        :max="100" 
                        :decimal-places="0"
                    />
                    <SrCalendar
                        v-model="reqParamsStore.t0Value"
                        label="T0:"
                    />
                    <SrCalendar
                        v-model="reqParamsStore.t1Value"
                        label="T1:"
                    />
                    
                </AccordionTab>
                <AccordionTab header="Photon Selection"  v-if="mission.value==='ICESat-2'" >
                    <SrMultiSelect
                        v-if="iceSat2SelectedAPI.value==='atl03'"
                        :menuOptions="reqParamsStore.surfaceTypeOptions"
                        label="Surface Type:"
                        ariaLabel="Select Surface Type"
                        @update:value="reqParamsStore.surfaceType = $event"
                        :default="[reqParamsStore.surfaceTypeOptions[0]]"
                    />
                    <!-- <SrRadioButtonBox
                        v-if="iceSat2SelectedAPI.value==='atl03'"
                        label="Signal Confidence"
                        ariaLabel="Signal Confidence"
                        :categories="reqParamsStore.signalConfidenceOptions"
                    /> -->
                    <SrMenuInput
                        v-if="iceSat2SelectedAPI.value==='atl03'"
                        label="Signal Confidence"
                        ariaLabel="Signal Confidence"
                        :menuOptions="reqParamsStore.signalConfidenceOptions"
                        @update:value="reqParamsStore.signalConfidence = $event"
                    />
                    <SrMultiSelect
                        v-if="iceSat2SelectedAPI.value==='atl08'"
                        :menuOptions="reqParamsStore.landTypeOptions"
                        label = "Land Type:"
                        aria-label="Select Land Type"
                        @update:value="reqParamsStore.landType = $event"
                        :default="reqParamsStore.landTypeOptions"
                    />
                    <SrSliderInput
                        v-if="iceSat2SelectedAPI.value==='atl03'"
                        v-model="reqParamsStore.YAPC"
                        label="YAPC:"
                    />   
                    <SrSwitchedSliderInput
                        label="SR YAPC:"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                    />
                    <SrSwitchedSliderInput
                        v-if="iceSat2SelectedAPI.value==='atl03'"
                        label="YAPC:"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                    />
                </AccordionTab>
                <AccordionTab header="Extents" v-if="mission.value==='ICESat-2'" >
                    <SrMenuInput
                        v-model="reqParamsStore.distanceIn"
                        label = "Distance In:"
                        aria-label="Select Distance in"
                        :menuOptions="reqParamsStore.distanceInOptions"
                    />
                    <SrSliderInput
                        v-if="reqParamsStore.distanceIn==='meters'"
                        v-model="reqParamsStore.lengthValue"
                        label="Length in meters:"
                        :min="5"
                        :max="200" 
                        :decimal-places="0"                  
                    />
                    <SrSliderInput
                        v-if="reqParamsStore.distanceIn==='meters'"
                        v-model="reqParamsStore.stepValue"
                        label="Step Size (meters):"
                        :min="5"
                        :max="100" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        v-if="reqParamsStore.distanceIn==='segments'"
                        v-model="reqParamsStore.lengthValue"
                        label="Length in segments:"
                        :min="5"
                        :max="200" 
                        :decimal-places="0"                  
                    />
                    <SrCheckbox
                        label="Pass Invalid:"
                        v-model="reqParamsStore.passInvalid"
                    />
                    <SrSliderInput
                        :insensitive="reqParamsStore.passInvalid"
                        v-model="reqParamsStore.alongTrackSpread"
                        label="Along Track Spread:"
                        :min="0"
                        :max="200" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        :insensitive="reqParamsStore.passInvalid"
                        v-model="reqParamsStore.minimumPhotonCount"
                        label="Minimum Photon Count:"
                        :min="0"
                        :max="200" 
                        :decimal-places="0"
                    />
                </AccordionTab>
                <AccordionTab header="Surface Elevation" v-if="mission.value==='ICESat-2' && iceSat2SelectedAPI.value==='atl06'"  > 
                    <SrSliderInput
                        v-model="reqParamsStore.maxIterations"
                        label="Max Iterations:"
                        :min="0"
                        :max="200" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.minWindowHeight"
                        label="Min window height (meters):"
                        :min="0"
                        :max="200" 
                        :decimal-places="0"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.maxRobustDispersion"
                        label="Max robust dispersion (meters):"
                        :min="0"
                        :max="200" 
                        :decimal-places="0"
                    />
                </AccordionTab>
                <AccordionTab header="Veg Density Alg" v-if="mission.value==='ICESat-2' && iceSat2SelectedAPI.value==='atl08'" >
                    <SrSliderInput
                        v-model="reqParamsStore.binSize"
                        label="Bin Size:"
                        :min="0"
                        :max="200"
                        :decimal-places="0"
                    />
                    <SrMenuInput
                        v-model="reqParamsStore.geoLocation"
                        label = "Geo Location:"
                        aria-label="Select Geo Location"
                        :menuOptions="reqParamsStore.geoLocationOptions"
                    />
                    <SrCheckbox
                        label="Use Absolute Heights:"
                        v-model="reqParamsStore.useAbsoluteHeights"
                    />
                    <SrCheckbox
                        label="Send Waveforms:"
                        v-model="reqParamsStore.sendWaveforms"
                    />
                    <SrCheckbox
                        label="Use ABoVE Classifier:"
                        v-model="reqParamsStore.useABoVEClassifier"   
                    />

                </AccordionTab>
                <AccordionTab header="Ancillary Fields"  v-if="mission.value==='ICESat-2'" >
                    <SrMenuMultiInput
                        v-if="iceSat2SelectedAPI.value==='atl03' || iceSat2SelectedAPI.value==='atl06'"
                        v-model="reqParamsStore.ATL03GeoSpatialFieldsOptions"
                        label="ATL03 GeoSpatial Fields:"
                        ariaLabel="Select ATL03 GeoSpatial Fields"
                        :menuOptions="reqParamsStore.ATL03GeoSpatialFieldsOptions"
                        :default="reqParamsStore.ATL03GeoSpatialFieldsOptions"
                    />  
                    <SrMenuMultiInput
                        v-if="iceSat2SelectedAPI.value==='atl03' || iceSat2SelectedAPI.value==='atl06'"
                        v-model="reqParamsStore.ATL03PhotonFieldsOptions"
                        label="ATL03 Photon Fields:"
                        ariaLabel="Select ATL03 Photon Fields"
                        :menuOptions="reqParamsStore.ATL03PhotonFieldsOptions"
                        :default="reqParamsStore.ATL03PhotonFieldsOptions"
                    /> 
                    <SrMenuMultiInput
                        v-if="iceSat2SelectedAPI.value==='atl06s'"
                        v-model="reqParamsStore.ATL06IceSegmentFieldsOptions"
                        label="ATL03 IceSegment Fields:"
                        ariaLabel="Select ATL03 IceSegment Fields"
                        :menuOptions="reqParamsStore.ATL06IceSegmentFieldsOptions"
                        :default="reqParamsStore.ATL06IceSegmentFieldsOptions"
                    />  
                    <SrMenuMultiInput
                        v-if="iceSat2SelectedAPI.value==='atl08'"
                        v-model="reqParamsStore.ATL08LandSegmentFieldsOptions"
                        label="ATL03 IceSegment Fields:"
                        ariaLabel="Select ATL03 IceSegment Fields"
                        :menuOptions="reqParamsStore.ATL08LandSegmentFieldsOptions"
                        :default="reqParamsStore.ATL08LandSegmentFieldsOptions"
                    />  
                </AccordionTab>
                <AccordionTab header="GEDI Footprint"  v-if="mission.value==='GEDI'" >
                    <SrMultiSelect
                        v-model="reqParamsStore.gediBeams"
                        label = "Select Beam(s):"
                        aria-label="Select Beams"
                        :menuOptions="reqParamsStore.gediBeamsOptions"
                        :default="reqParamsStore.gediBeamsOptions"
                    />
                    <SrCheckbox
                        label="Degrade Flag:"
                        v-model="reqParamsStore.degradeFlag"
                    />
                    <SrCheckbox
                        label="L2 Quality Flag:"
                        v-model="reqParamsStore.l2QualityFlag"
                    />
                    <SrCheckbox
                        label="L4 Quality Flag:"
                        v-model="reqParamsStore.l4QualityFlag"
                    />
                    <SrCheckbox
                        label="Surface Flag:"
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
                <AccordionTab header="Output">
                    <SrCheckbox
                        label="Save Output"
                        v-model="reqParamsStore.saveOutput"
                    />
                    <SrCheckbox
                        v-if = "reqParamsStore.saveOutput"
                        label="Staged"
                        v-model="reqParamsStore.staged"
                    />
                    <SrMenuInput
                        v-if = "reqParamsStore.saveOutput"
                        v-model="reqParamsStore.outputFormat"
                        label = "Output Format:"
                        aria-label="Select Output Format"
                        :menuOptions="reqParamsStore.outputFormatOptions"
                    />
                    <SrMenuInput
                        v-if = "reqParamsStore.saveOutput && reqParamsStore.staged===false"
                        v-model="reqParamsStore.outputLocation"
                        label = "Output Location:"
                        aria-label="Select Output Location"
                        :menuOptions="reqParamsStore.outputLocationOptions"
                    />
                    <SrTextInput
                        v-if = "reqParamsStore.saveOutput && reqParamsStore.staged===false"
                        v-model="reqParamsStore.outputLocationPath"
                        label = "Output Location Path:"
                        aria-label="Enter Output Location Path"
                    />
                    <SrMenuInput
                        v-if = "reqParamsStore.saveOutput  && reqParamsStore.outputLocation.name==='S3' && reqParamsStore.staged===false"
                        v-model="reqParamsStore.awsRegion"
                        label = "AWS Region:"
                        aria-label="Select AWS Region"
                        :menuOptions="reqParamsStore.awsRegionOptions"
                    />
                    <SrCredsFileUpload
                        v-if = "reqParamsStore.saveOutput && reqParamsStore.outputLocation.name==='S3' && reqParamsStore.staged===false"
                    />
                </AccordionTab>
            </Accordion>
        </div>
    </div>
</template>

<style scoped>

.adv-opt-header {
    justify-content: center;
}

.adv-opt-card {
    padding: 0.1250rem;
    margin: 0.1250rem;
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