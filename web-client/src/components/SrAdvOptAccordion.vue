<script setup lang="ts">

import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import { defineAsyncComponent,ref } from 'vue';

const SrYAPC = defineAsyncComponent(() => import('./SrYAPC.vue'));
const SrAtl03Cnf = defineAsyncComponent(() => import('./SrAtl03Cnf.vue'));
const SrAtl08Cnf = defineAsyncComponent(() => import('./SrAtl08Cnf.vue'));
const SrExtents = defineAsyncComponent(() => import('./SrExtents.vue'));
const SrAncillaryFields = defineAsyncComponent(() => import('./SrAncillaryFields.vue'));
const SrSurfaceElevation = defineAsyncComponent(() => import('./SrSurfaceElevation.vue'));
const SrGranuleSelection = defineAsyncComponent(() => import('./SrGranuleSelection.vue'));
const SrGenUserPresets = defineAsyncComponent(() => import('./SrGenUserPresets.vue'));
const SrGenUserOptions = defineAsyncComponent(() => import('./SrGenUserOptions.vue'));
const SrVegDensity = defineAsyncComponent(() => import('./SrVegDensity.vue'));
const SrGedi = defineAsyncComponent(() => import('./SrGedi.vue'));
const SrRaster = defineAsyncComponent(() => import('./SrRaster.vue'));

interface Props {
  title: string;
  ariaTitle: string;
  mission: string;
  iceSat2SelectedAPI: string;
  gediSelectedAPI: string;
}

const props = defineProps<Props>();
const expandedPanels = ref<number[]>([]);

const onPanelOpen = (value:any) => {
    //console.log('onPanelOpen', value, "type: ", typeof value);
    expandedPanels.value.push(value.index);
};

const onPanelClose = (value:any) => {
    //console.log('onPanelClose', value, "type: ", typeof value);
    expandedPanels.value = expandedPanels.value.filter((p) => p !== value.index);
};

const isExpanded = (panelIndex: number) => {
  return expandedPanels.value.some((p) => p === panelIndex);
};

</script>

<template>
    <div class="adv-opt-card">
        <div class="adv-opts-wrapper">
            <Accordion class="sr-adv-accordian" :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus"  @tab-open="onPanelOpen" @tab-close="onPanelClose">
                <AccordionPanel value="0">
                    <AccordionHeader>Presets</AccordionHeader>
                    <AccordionContent v-if="isExpanded(0)">
                        <SrGenUserPresets />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="1">
                    <AccordionHeader>General</AccordionHeader>
                    <AccordionContent v-if="isExpanded(1)">
                        <SrGenUserOptions />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="2" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Granule Selection</AccordionHeader>
                    <AccordionContent v-if="isExpanded(2)">
                        <SrGranuleSelection />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="3"  v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Photon Selection</AccordionHeader>
                    <AccordionContent v-if="isExpanded(3)">
                        <SrAtl03Cnf />
                        <SrAtl08Cnf />
                        <SrYAPC />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="4" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Extents</AccordionHeader>
                    <AccordionContent v-if="isExpanded(4)">
                        <SrExtents />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="5" v-if="mission==='ICESat-2' && props.iceSat2SelectedAPI.includes('atl06')"  > 
                    <AccordionHeader>Surface Elevation</AccordionHeader>
                    <AccordionContent  v-if="isExpanded(5)">
                        <SrSurfaceElevation />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="6" v-if="mission==='ICESat-2' && props.iceSat2SelectedAPI.includes('atl08')" >
                    <AccordionHeader>Veg Density Alg</AccordionHeader>
                    <AccordionContent v-if="isExpanded(6)">
                        <SrVegDensity />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="7" v-if="mission==='ICESat-2'" >
                    <AccordionHeader>Ancillary Fields</AccordionHeader>
                    <AccordionContent v-if="isExpanded(7)">
                        <SrAncillaryFields :iceSat2SelectedAPI="props.iceSat2SelectedAPI"/>
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="8" v-if="mission==='GEDI'" >
                    <AccordionHeader>GEDI Footprint</AccordionHeader>
                    <AccordionContent v-if="isExpanded(8)">
                        <SrGedi />
                    </AccordionContent>
                </AccordionPanel>
                <AccordionPanel value="9">
                    <AccordionHeader>Raster Sampling</AccordionHeader>
                    <AccordionContent v-if="isExpanded(9)">
                        <SrRaster />
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