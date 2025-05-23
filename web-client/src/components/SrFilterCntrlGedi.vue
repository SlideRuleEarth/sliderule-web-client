<template>
    <div>
        <SrCustomTooltip ref="tooltipRef" />
        <Card>
            <template #title>
                <div class="sr-card-title-center">
                    <SrElTitleEdit 
                        @mouseover="handleMouseOver"
                        @mouseleave="handleMouseLeave"
                    />
                </div>
            </template>
            <template #content>
                <div class="sr-highlighted-track-details">
                    <p class = "sr-highlighted-track-details-1"> {{ highlightedTrackDetails1 }} </p>
                </div>
                <Fieldset legend="Advanced Filter Control" class="sr-filter-panel" toggleable :collapsed="true">
                    <div class="sr-cycles-legend-panel">
                        <Button 
                            class="sr-reset-btn sr-glow-button"
                            icon="pi pi-refresh"
                            variant="text"
                            rounded
                            label="Reset" 
                            @click="resetFilter"
                            size="small"
                        ></Button>
                        <div class="sr-select-boxes">
                            <div class="sr-rgt-y-atc">
                                <div class="sr-select-box">
                                    <div class="sr-header">
                                        <p class="sr-select-box-hdr">Tracks</p>
                                    </div>
                                    <Listbox 
                                        class="sr-select-lists"
                                        v-model="selectedRgtReactive" 
                                        optionLabel="label"
                                        optionValue="value"
                                        :multiple="false"
                                        :options="computedRgtOptions"
                                        @change="handleValueChange"
                                    >
                                    </Listbox>
                                </div>
                        </div>
                            <SrCycleSelect label="Orbits"/>
                        </div>
                        <div class="sr-beam-y-atc">
                            <div>
                                <SrBeamPatternGedi :reqIdStr="recTreeStore.selectedReqIdStr"/>
                            </div>
                        </div>
                    </div>
                </Fieldset>
            </template>                    
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { resetFilter } from '@/utils/SrMapUtils';
import Button from 'primevue/button';
import { selectedRgtReactive, updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import Listbox from 'primevue/listbox';
import SrBeamPatternGedi from '@/components/SrBeamPatternGedi.vue';
import SrCycleSelect from '@/components/SrCycleSelect.vue';
import Fieldset from "primevue/fieldset";
import Card from 'primevue/card';
import SrElTitleEdit from '@/components/SrElTitleEdit.vue';
import SrCustomTooltip from "@/components/SrCustomTooltip.vue";

const recTreeStore = useRecTreeStore();
const globalChartStore = useGlobalChartStore();
const tooltipRef = ref();


const highlightedTrackDetails1 = computed(() => {
    return `orbits: ${globalChartStore.getCycles()} track: ${globalChartStore.getRgt()} beams: ${globalChartStore.getSpots()} `
});


const computedRgtOptions = computed(() => {
    const rgtOptions= globalChartStore.getRgtOptions();
    //console.log('SrFilterCntrl computedRgtOptions:',rgtOptions);
    return rgtOptions;
});
function handleMouseOver(e: MouseEvent) {
    //console.log('tooltipRef in handleMouseOver:', tooltipRef.value);
    //console.log(`Showing tooltip at (${e.x}, ${e.y})` );

    tooltipRef.value?.showTooltip?.(
        e,
        'This is the title of the elevation plot. You can edit it. It will reset when you reload the page'
    );
}

function handleMouseLeave() {
    //console.log('tooltipRef in handleMouseLeave:', tooltipRef.value);
    tooltipRef.value?.hideTooltip?.();
}

function handleValueChange(value) {
    //console.log('SrFilterCntrl handleValueChange:', value);
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        nextTick(() => {
            updatePlotAndSelectedTrackMapLayer("SrFilterCntrl:handleValueChange - RGT");
        })
    } else {
        console.warn('SrFilterCntrl:handleValueChange - RGT reqId is undefined');
    }
    //console.log('SrFilterCntrl:handleValueChange:- RGT:', value);
}

</script>

<style scoped>
.sr-cycles-legend-panel{
    display: flex;
    flex-direction: column;
    justify-content:space-between;
    align-items:center;
    margin: 0rem;
    padding: 0rem;
    width: auto;
}

.sr-header {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: small;
    font-weight: bold;
    color: var(--color-text);
}

.sr-card-title-center {
    display: flex;
    justify-content: center;
    align-items: center;
}

.sr-highlighted-track-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: auto;
    font-size: small;
    color: var(--color-text);
    background-color: var(--color-bg);
    border-radius: 0.25rem;
}

.sr-highlighted-track-details-1 {
    margin-block-start: 0rem;
    margin-block-end: 0.125rem;
    font-size: small;
}
.sr-highlighted-track-details-2 {
    margin-block-start: 0rem;
    margin-block-end: 0.25rem;
}

.sr-filter-panel {
    min-width: 26rem;
}
.sr-filter-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    width: fit-content;
    min-width: 30rem;
}

.sr-select-lists {
    display: flex;
    flex-direction: column;
    justify-content:center;
    align-items:flex-start;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
    max-width: 10rem;
}

.sr-select-boxes {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: flex-start;
    width: auto;
}

.sr-select-box{
    display: flex;
    flex-direction: column;
    justify-content:center;
    align-items:flex-start;
    margin: 0.25rem;
    padding: 0.25rem;
    width: auto;
    max-width: 10rem;
}

.sr-y-atc-boxs{
    display: flex;
    flex-direction: column;
    justify-content:flex-start;
    align-items:center;
}

.sr-select-box-hdr{
    display: flex;
    justify-content:center;
    align-items:center;
    margin: 0.125rem;
    padding: 0.125rem;
    width: auto;
    max-width: 10rem;
    font-size:medium;
    font-weight: bold;
    color: var(--color-text);
    background-color: var(--color-bg);
    border-radius: 0.25rem;
}

:deep(.p-listbox-list-container) {
    width: 100%;
    min-width: 5rem;
    max-width: 16rem;
    max-height: 10rem;
    margin: 0.25rem;
}

:deep(.p-listbox-option) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.25rem;
}
:deep(.p-panel-header) {
    justify-content: center;
    align-items: center;
}
:deep(.sr-photon-cloud .p-card-body){
    justify-content: center;
    align-items: center;
}
:deep(.p-card-content){
    justify-content: center;
    align-items: center;
}
:deep(.p-card-title) {
    justify-content: center;
    align-items: center;
}
:deep(.p-panel-content) {
    justify-content: center;
    padding: 0.125rem;
    margin: 0.125rem;
}

:deep(.p-listbox .p-listbox-list .p-listbox-option.p-listbox-option-selected){
    color: var(--p-primary-color);
    font-weight: bold;
}
</style>