<template>
    <Card>
        <template #title>
            <div class="sr-card-title-center">Highlighted Track</div>
        </template>
        <template #content>
            <div class="sr-highlighted-track-details">
                <p class = "sr-highlighted-track-details-1"> {{ highlightedTrackDetails1 }} </p>
                <p class = "sr-highlighted-track-details-2"> {{ highlightedTrackDetails2 }} </p>
            </div>
            <Fieldset legend="Advanced Filter Control" class="sr-filter-panel" toggleable :collapsed="true">
                <div class="sr-cycles-legend-panel">
                    <div class="sr-select-boxes">
                        <div class="sr-rgt-y-atc">
                            <div class="sr-select-box">
                                <div class="sr-header">
                                    <p class="sr-select-box-hdr">Rgts</p>
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
                        <SrCycleSelect />
                    </div>
                    <div class="sr-beam-y-atc">
                        <div>
                            <SrBeamPattern :reqIdStr="recTreeStore.selectedReqIdStr"/>
                        </div>
                        <div>
                            <SrYatcFilterCntrl  />
                        </div>
                    </div>
                 </div>
            </Fieldset>
        </template>                    
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { selectedRgtReactive,selectedCyclesReactive } from "@/utils/plotUtils";
import { getAllCycleOptions, getAllFilteredCycleOptions } from "@/utils/SrDuckDbUtils";
import Listbox from 'primevue/listbox';
import SrBeamPattern from '@/components/SrBeamPattern.vue';
import SrYatcFilterCntrl from '@/components/SrYatcFilterCntrl.vue';
import SrCycleSelect from '@/components/SrCycleSelect.vue';
import Fieldset from "primevue/fieldset";
import Card from 'primevue/card';
import Button from 'primevue/button';

const recTreeStore = useRecTreeStore();
const globalChartStore = useGlobalChartStore();

const computedScOrientLabels = computed(() => {
    return globalChartStore.getScOrientsLabels();
});

const computed_use_y_atc_label = computed(() => {
    return globalChartStore.use_y_atc_filter? 'uses y_atc filter' : '';
});

const highlightedTrackDetails1 = computed(() => {
    return `cycles: ${globalChartStore.getCycles()} rgt: ${globalChartStore.getRgt()} spots: ${globalChartStore.getSpots()} beams:${globalChartStore.getGtLabels()} tracks:${globalChartStore.getTracks()} pairs:${globalChartStore.getPairs()}`
});

const highlightedTrackDetails2 = computed(() => {
    return `sc_orients: ${computedScOrientLabels.value}  ${computed_use_y_atc_label.value}`;
});

const computedRgtOptions = computed(() => {
    const rgtOptions= globalChartStore.getRgtOptions();
    //console.log('SrFilterCntrl computedRgtOptions:',rgtOptions);
    return rgtOptions;
});

function handleValueChange(value) {
    console.log('SrFilterCntrl handleValueChange:', value);
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        globalChartStore.use_y_atc_filter = false;
        globalChartStore.selected_y_atc = undefined;
    } else {
        console.warn('reqId is undefined');
    }
    console.log('SrFilterCntrl handleValueChange:', value);
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

.sr-cycles-btn-panel{
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
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

.sr-beam-y-atc {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    width: auto;
    margin-top:0.5rem;
}
.sr-select-all-btn{
    margin-left: 0.5rem;
    font-size: smaller;
    white-space: nowrap;
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