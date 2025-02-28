
<template>
    <div class="sr-select-box">
        <div class="sr-header">
            <p class="sr-select-box-hdr">Cycles({{ globalChartStore.selectedCycleOptions.length }})</p>
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
            <Button class="sr-select-all-btn"
                label="Reset" 
                @click="resetCycles"
                size="small"
            ></Button>
            <Button class="sr-select-all-btn"
                label="All" 
                @click="setAllCycles"
                size="small"
            ></Button>
        </div>
    </div>
</template>

<script setup lang="ts">

import { computed } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import Button from 'primevue/button';
import Listbox from 'primevue/listbox';
import { selectedCyclesReactive } from "@/utils/plotUtils";
import { getAllCycleOptions, getAllFilteredCycleOptions } from "@/utils/SrDuckDbUtils";
import { useRecTreeStore } from '@/stores/recTreeStore';

const globalChartStore = useGlobalChartStore();
const recTreeStore = useRecTreeStore();

const computedCycleOptions = computed(() => {
    return globalChartStore.getCycleOptions();
});

async function resetCycles() {
    const filteredCycleOptions = await getAllFilteredCycleOptions(recTreeStore.selectedReqId)
    globalChartStore.setSelectedCycleOptions(filteredCycleOptions);
}

async function setAllCycles() {
    const retObj = await getAllCycleOptions(recTreeStore.selectedReqId)
    console.log('setAllCycles allCycleOptions:',retObj.cycleOptions);
    globalChartStore.setSelectedCycleOptions(retObj.cycleOptions);
}

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
</style>