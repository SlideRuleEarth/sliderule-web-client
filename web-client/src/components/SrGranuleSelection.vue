<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrCalendar from './SrCalendar.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrReqTracks from './SrReqTracks.vue';
import SrReqBeams from './SrReqBeams.vue';

const reqParamsStore = useReqParamsStore();

onMounted(() => {
    console.log('Mounted SrGranuleSelection');
});
onUnmounted(() => {
    console.log('Unmounted SrGranuleSelection');
});


</script>

<template>
    <div class="sr-granule-selection-container">
        <div class="sr-granule-selection-header">
            <SrCheckbox
                v-model="reqParamsStore.enableGranuleSelection"
                label="Granule Selection"
                labelFontSize="large"
                tooltipText="Granules are the smallest unit of data that can be independently accessed, processed, and analyzed." 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#overview"
            />
        </div>
        <div class="sr-granule-tracks-beams-div"> 
            <SrReqTracks/>
            <SrReqBeams/>
        </div> 
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.rgtValue"
            label="RGT"
            :min="1"
            :max="10000" 
            :decimalPlaces="0"
            tooltipText="RGT is the reference ground track: defaults to all if not specified"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.cycleValue"
            label="Cycle"
            :min="1"
            :max="100" 
            :decimalPlaces="0"
            tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.regionValue"
            label="Atl03 Granule Region"
            :min="0"
            :max="14" 
            :decimalPlaces="0"
            tooltipText="atl03 granule region (zero means all), See section 2.5 pages 14-17 of the 'Algorithm Theoretical Basis Document'"
            tooltipUrl="https://nsidc.org/sites/default/files/documents/technical-reference/icesat2_atl03_atbd_v006.pdf"
        />
        <SrCalendar
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.t0Value"
            label="T0"
            tooltipText="Start Time for filtering granules"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrCalendar
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.t1Value"
            label="T1"
            tooltipText="End Time for filtering granules"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />

    </div>

</template>

<style scoped>

.sr-granule-selection-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--border-radius);
}
.sr-granule-selection-header{
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}
.sr-granule-tracks-beams-div {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 1rem;
}
.sr-granule-tracks-div {
    margin-right: 1rem;
}
.sr-granule-beams-div {
    margin-left: 1rem;
}
</style>