<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import SrMenuInput from './SrMenuInput.vue';
import SrMenu from './SrMenu.vue';
import SrMultiSelectNumber from './SrMultiSelectNumber.vue'
import { useMapStore } from '@/stores/mapStore';
import SrCheckbox from './SrCheckbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrRasterParamsDataTable from './SrRasterParamsDataTable.vue';
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
import SrStorageUsage from './SrStorageUsage.vue';
import SrGranuleSelection from './SrGranuleSelection.vue';
import SrDebug from './SrDebug.vue';
import SrColorPalette  from "./SrColorPalette.vue";
import SrAdvancedConfig from './SrAdvancedConfig.vue';
import SrGenUserPresets from './SrGenUserPresets.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';

const reqParamsStore = useReqParamsStore();

const mapStore = useMapStore();
//////////////

onUnmounted(() => {

})



interface Props {
  title: string;
  ariaTitle: string;
  mission: string;
  iceSat2SelectedAPI: string;
  gediSelectedAPI: string;
}

const props = defineProps<Props>();
 
onMounted(() => {
    //console.log('Mounted SrAdvOptAccordian');
});


</script>

<template>
    <div class="adv-opt-card">
        <div class="adv-opts-wrapper">
            <Accordion class="sr-adv-accordian" :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" >
                <AccordionPanel value="0">
                    <AccordionHeader>Presets</AccordionHeader>
                    <AccordionContent>
                        <SrGenUserPresets />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="1">
                    <AccordionHeader>General</AccordionHeader>
                    <AccordionContent>
                        <SrMenu
                            v-model="mapStore.polygonSource"
                            label = "Polygon Source"
                            aria-label="Select Polygon Source"
                            :menuOptions="mapStore.polygonSourceItems"
                            :getSelectedMenuItem="useMapStore().getPolySource"
                            :setSelectedMenuItem="useMapStore().setPolySource"
                            tooltipText="This is how you define the region of interest"
                            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#polygons"
                        />
                        <SrGeoJsonFileUpload
                            v-if="mapStore.polygonSource==='Upload geojson File'"
                        />
                        <SrCheckbox
                            label="Ignore Poly for CMR"
                            v-model="reqParamsStore.ignorePolygon"
                            tooltipText="When you check this the server skips the CMR polygon search and uses the resources you specify below"
                            tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/earthdata.html#cmr"
                        />
                        <SrResources v-if="reqParamsStore.ignorePolygon"/>
                        <Fieldset class="sr-timeouts-fieldset" legend="Timeouts" :toggleable="true" :collapsed="true">
                            <SrSliderInput
                                :insensitive="!reqParamsStore.useGlobalTimeout()"
                                v-model="reqParamsStore.totalTimeoutValue"
                                label="Timeout"
                                :min="60"
                                :max="1000000"
                                :defaultValue="reqParamsStore.totalTimeoutValue" 
                                :decimalPlaces="0"
                                tooltipText="global timeout setting that sets all timeouts at once (can be overridden by further specifying the other timeouts)"
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                            />
                            <SrSwitchedSliderInput
                                v-model="reqParamsStore.reqTimeoutValue"
                                :getCheckboxValue="reqParamsStore.getUseReqTimeout"
                                :setCheckboxValue="reqParamsStore.setUseReqTimeout"
                                :getValue="reqParamsStore.getReqTimeout"
                                :setValue="reqParamsStore.setReqTimeout"
                                label="rqst-timeout"
                                :min="1"
                                :max="1000000" 
                                :decimalPlaces="0"
                                tooltipText="total time in seconds for request to be processed"
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                            />                    
                            <SrSwitchedSliderInput
                                v-model="reqParamsStore.nodeTimeoutValue"
                                :getCheckboxValue="reqParamsStore.getUseNodeTimeout"
                                :setCheckboxValue="reqParamsStore.setUseNodeTimeout"
                                :getValue="reqParamsStore.getNodeTimeout"
                                :setValue="reqParamsStore.setNodeTimeout"
                                label="node-timeout"
                                :min="1"
                                :max="100000" 
                                :decimalPlaces="0"
                                tooltipText="time in seconds for a single node to work on a distributed request (used for proxied requests)"
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                            />
                            <SrSwitchedSliderInput
                                v-model="reqParamsStore.readTimeoutValue"
                                :getCheckboxValue="reqParamsStore.getUseReadTimeout"
                                :setCheckboxValue="reqParamsStore.setUseReadTimeout"
                                :getValue="reqParamsStore.getReadTimeout"
                                :setValue="reqParamsStore.setReadTimeout"
                                label="read-timeout"
                                :min="1"
                                :max="1000000" 
                                :decimalPlaces="0"
                                tooltipText="time in seconds for a single read of an asset to take"
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
                            />
                            <div class="sr-restore-timeout-defaults">
                                <Button label="Restore Default Timeout behavior" @click="reqParamsStore.restoreTimeouts()"/>
                            </div>  
                        </Fieldset>
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="2" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Granule Selection</AccordionHeader>
                    <AccordionContent>
                        <SrGranuleSelection />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="3"  v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Photon Selection</AccordionHeader>
                    <AccordionContent>
                        <SrAtl03Cnf />
                        <SrAtl08Cnf />
                        <SrYAPC />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="4" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Extents</AccordionHeader>
                    <AccordionContent>
                        <SrExtents />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="5" v-if="mission==='ICESat-2' && props.iceSat2SelectedAPI==='atl06'"  > 
                    <AccordionHeader>Surface Elevation</AccordionHeader>
                    <AccordionContent>
                        <SrSurfaceElevation />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="6" v-if="mission==='ICESat-2' && props.iceSat2SelectedAPI==='atl08'" >
                    <AccordionHeader>Veg Density Alg</AccordionHeader>
                    <AccordionContent>
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
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="7" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Ancillary Fields</AccordionHeader>
                    <AccordionContent>
                        <SrAncillaryFields :iceSat2SelectedAPI="props.iceSat2SelectedAPI"/>
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="8" v-if="mission==='GEDI'" >
                    <AccordionHeader>GEDI Footprint</AccordionHeader>
                    <AccordionContent>
                        <SrMultiSelectNumber
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
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="9">
                    <AccordionHeader>Raster Sampling</AccordionHeader>
                    <AccordionContent>
                        <div class="sr-raster-sampling-table-section">
                            <div class="sr-raster-sampling-table-head">
                                <h3>Raster Sampling Parameters Table</h3>
                            </div>  
                            <div class="sr-raster-sampling-table">
                                <SrRasterParamsDataTable  storeNamePrefix="rasterParams"/>
                            </div> 
                        </div>
                        <SrRasterParams />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="10">
                    <AccordionHeader>System Configuration</AccordionHeader>
                    <AccordionContent>
                        <SrSysConfig />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="11">
                    <AccordionHeader>Storage Usage</AccordionHeader>
                    <AccordionContent>
                        <SrStorageUsage />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="12">
                    <AccordionHeader>Advanced</AccordionHeader>
                    <AccordionContent>
                        <div class="sr-adv-opt-panel">
                            <SrDebug />
                            <SrAdvancedConfig />
                            <SrColorPalette />
                        </div>
                    </AccordionContent>
                </AccordionPanel>
            </Accordion>
        </div>
    </div>
</template>

<style scoped>

.adv-opt-header {
    justify-content: center;
    align-items: center;
    margin-top: 0rem;
}

.adv-opt-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.adv-opts-wrapper{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
}

.sr-adv-accordian {
    width: 100%;
}

.sr-timeouts-fieldset {
    margin-top: 1rem;
}

.sr-color-palette {
    display: flex;
    flex-direction: column;
}

.sr-raster-sampling-table-section {
    border-radius: var(--p-border-radius);
    border: 2px solid var(--surface-d);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    margin: 0.125rem;
    padding: 0.125rem;
}
.sr-raster-sampling-table-head {
    display: flex;
    justify-content: center;
    align-items: center;
}
.sr-raster-sampling-table {
    flex:auto;
    width: 25rem;
    overflow-x: scroll;
    white-space: nowrap;
}

.sr-adv-opt-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: left;
}


.file-upload-panel { 
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
}
:deep(.p-progressbar-label){
    color: var(--p-text-color);
}
.toast-container {
    display: flex;
    padding: 1rem; /* 12px 3rem in bootstrap, adjust accordingly */
    gap: 1rem; /* adjust as needed */
    width: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: var(--p-border-radius);
}

.upload-icon {
    /* Styles for pi pi-cloud-upload */
    color: var(--p-primary-color); /* primary-500 color  #2c7be5;*/
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
    color: var(--p-text-color); /* text-700 color, adjust as needed */
}

.progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px; /* adjust as needed */
}

.sr-restore-timeout-defaults {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
}
</style>