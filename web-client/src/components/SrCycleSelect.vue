
<template>
    <div class="sr-select-box">
        <div class="sr-header">
            <p class="sr-select-box-hdr">{{ displayLabel }} ({{ globalChartStore.selectedCycleOptions.length }})</p>
        </div>
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
        <div class = "sr-cycles-btn-panel">
            <Button 
                class="sr-select-all-btn sr-glow-button"
                icon="pi pi-filter"
                variant="text"
                rounded
                label="Filter" 
                @click="filterCycles"
                size="small"
            ></Button>
            <Button 
                class="sr-select-all-btn  sr-glow-button"
                icon="pi pi-clone"
                variant="text"
                rounded
                label="All" 
                @click="setAllCycles"
                size="small"
            ></Button>
        </div>
    </div>
</template>

<script setup lang="ts">

import { computed, nextTick, onMounted } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import Button from 'primevue/button';
import Listbox from 'primevue/listbox';
import { selectedCyclesReactive, updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";
import { useRecTreeStore } from '@/stores/recTreeStore';
import { resetFilterCycleOptions } from '@/utils/SrMapUtils';

const globalChartStore = useGlobalChartStore();
const recTreeStore = useRecTreeStore();

const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
});

const props = defineProps<{
    label?: string
}>();

const displayLabel = computed(() => props.label ?? 'Cycles');

async function filterCycles() {
    //console.log('filterCycles:', selectedCyclesReactive.value);
    resetFilterCycleOptions();
}

async function setAllCycles() {
    //console.log('setAllCycles:', selectedCyclesReactive.value);
    selectedCyclesReactive.value = computedCycleOptions.value.map(option => option.value); // Select all cycles
}

onMounted(() => {
    console.log('SrCycleSelect component mounted');
});

function handleValueChange(value) {
    console.log('SrFilterCntrl handleValueChange:', value);
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        nextTick(() => {
            updatePlotAndSelectedTrackMapLayer("SrFilterCntrl:handleValueChange - RGT");
        })
    } else {
        console.warn('reqId is undefined');
    }
    console.log('SrFilterCntrl handleValueChange:', value);
}


</script>

<style scoped>

.sr-header {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: small;
    font-weight: bold;
    color: var(--color-text);
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


.sr-cycles-btn-panel{
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
}


:deep(.p-listbox .p-listbox-list .p-listbox-option.p-listbox-option-selected){
    color: var(--p-primary-color);
    font-weight: bold;
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

.sr-select-all-btn{
    margin-left: 0.5rem;
    font-size: smaller;
    white-space: nowrap;
}


</style>