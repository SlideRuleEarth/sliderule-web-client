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
                            <p class="sr-select-box-hdr">Rgts</p>
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
                            <div class="sr-y-atc-box">
                                <SrYatcFilterCntrl />
                            </div>
                        </div>
                        <div class="sr-select-box">
                            <p class="sr-select-box-hdr">Cycles</p>
                            <Listbox 
                                class="sr-select-lists"
                                v-model="selectedCyclesReactive" 
                                optionLabel="label"
                                optionValue="value"
                                :multiple="true"
                                :metaKeySelection="true"
                                :options="computedCycleOptions"
                                @change="handleValueChange"
                            >
                            </Listbox>
                        </div>
                    </div>
                    <SrBeamPattern :reqIdStr="recTreeStore.selectedReqIdStr"/>
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
import Listbox from 'primevue/listbox';
import SrBeamPattern from './SrBeamPattern.vue';
import SrYatcFilterCntrl from './SrYatcFilterCntrl.vue';
import Fieldset from "primevue/fieldset";
import Card from 'primevue/card';

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

const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
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
        //callPlotUpdateDebounced('from handleModelValueChange');
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
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
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
    justify-content: center;
    align-items: flex-start;
    margin: 0.5rem;
    padding: 0.5rem;
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

.sr-y-atc-box{
    display: flex;
    flex-direction: column;
    justify-content:center;
    align-items:center;
}

.sr-select-box-hdr{
    display: flex;
    justify-content:center;
    align-items:center;
    margin: 0.25rem;
    padding: 0.25rem;
    width: auto;
    max-width: 10rem;
    font-size: small;
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

</style>