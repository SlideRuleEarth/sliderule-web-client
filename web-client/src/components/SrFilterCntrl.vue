<template>
    <Card>
        <template #title>
            <div class="sr-card-title-center">Highlighted Track</div>
        </template>
        <template #content>
            <p class="sr-highlighted-track-details">
                {{ highlightedTrackDetails }}
            </p>
            <Fieldset legend="Advanced Filter Control" class="sr-filter-panel" toggleable :collapsed="true">
                <div class="sr-cycles-legend-panel">
                    <div class="sr-select-boxes">
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
import Fieldset from "primevue/fieldset";
import Card from 'primevue/card';

const recTreeStore = useRecTreeStore();
const globalChartStore = useGlobalChartStore();

const computedScOrientLabels = computed(() => {
    return globalChartStore.getScOrientsLabels();
});

const highlightedTrackDetails = computed(() => {
    return `cycles: ${globalChartStore.getCycles()} rgt: ${globalChartStore.getRgt()} spots: ${globalChartStore.getSpots()} sc_orients: ${computedScOrientLabels.value} beams:${globalChartStore.getGtLabels()} tracks:${globalChartStore.getTracks()} pairs:${globalChartStore.getPairs()}`;
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
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
    font-size: small;
    color: var(--color-text);
    background-color: var(--color-bg);
    border-radius: 0.25rem;
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