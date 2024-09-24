<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import Fieldset from 'primevue/fieldset';
import SrCalendar from './SrCalendar.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrListbox from './SrListbox.vue';
import { tracksOptions,beamsOptions,getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { SrListNumberItem } from '@/stores/atlChartFilterStore';

const reqParamsStore = useReqParamsStore();

onMounted(() => {
    //console.log('Mounted SrGranuleSelection');
});

onUnmounted(() => {
    //console.log('Unmounted SrGranuleSelection');
});

const TracksSelection = (tracks:SrListNumberItem[]) => {
    console.log('TracksSelection:',tracks);
}

const BeamsSelection = (gts:SrListNumberItem[]) => {
    console.log('BeamsSelection:',gts);
    const tracks = getBeamsAndTracksWithGts(gts).tracks;
    const trackItems = tracks.map((item) => ({label: item.value.toString(), value: item.value}));
    reqParamsStore.setTracks(trackItems);
    console.log('BeamsSelection gts:',gts, ' => tracks:',reqParamsStore.tracks, ' beams:',reqParamsStore.beams);
}

</script>

<template>
    <div class="sr-granule-selection-container">
        <div class="sr-granule-selection-header">
            <SrCheckbox
                v-model="reqParamsStore.enableGranuleSelection"
                :getCheckboxValue="reqParamsStore.getEnableGranuleSelection"
                :setCheckboxValue="reqParamsStore.setEnableGranuleSelection"
                label="Granule Selection"
                labelFontSize="large"
                tooltipText="Granules are the smallest unit of data that can be independently accessed, processed, and analyzed." 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#overview"
            />
        </div>
        <div class="sr-granule-tracks-beams-div"> 
            <!-- <SrReqTracks/>
            <SrReqBeams/> -->
            <SrListbox id="tracks" 
                :insensitive="!reqParamsStore.enableGranuleSelection"
                label="Track(s)" 
                v-model="reqParamsStore.tracks"
                :getSelectedMenuItem="reqParamsStore.getTracks"
                :setSelectedMenuItem="reqParamsStore.setTracks"
                :menuOptions="tracksOptions" 
                tooltipText="ATLAS laser beams are divided into three tracks of weak and strong beams"
                @update:modelValue="TracksSelection"
            />
            <SrListbox id="beams" 
                :insensitive="!reqParamsStore.enableGranuleSelection"
                label="Beam(s)" 
                v-model="reqParamsStore.beams"
                :getSelectedMenuItem="reqParamsStore.getBeams"
                :setSelectedMenuItem="reqParamsStore.setBeams"
                :menuOptions="beamsOptions" 
                tooltipText="ATLAS laser beams are divided into three tracks of weak and strong beams"
                @update:modelValue="BeamsSelection"
            />
        </div> 
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.rgtValue"
            :getCheckboxValue="reqParamsStore.getUseRgt"
            :setCheckboxValue="reqParamsStore.setUseRgt"
            :getValue="reqParamsStore.getRgt"
            :setValue="reqParamsStore.setRgt"
            label="RGT"
            :min="1"
            :max="10000" 
            :decimalPlaces="0"
            tooltipText="RGT is the reference ground track: defaults to all if not specified"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.cycleValue"
            :getCheckboxValue="reqParamsStore.getUseCycle"
            :setCheckboxValue="reqParamsStore.setUseCycle"
            :getValue="reqParamsStore.getCycle"
            :setValue="reqParamsStore.setCycle"
            label="Cycle"
            :min="1"
            :max="100" 
            :decimalPlaces="0"
            tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.regionValue"
            :getCheckboxValue="reqParamsStore.getUseRegion"
            :setCheckboxValue="reqParamsStore.setUseRegion"
            :getValue="reqParamsStore.getRegion"
            :setValue="reqParamsStore.setRegion"
            label="Atl03 Granule Region"
            :min="0"
            :max="14" 
            :decimalPlaces="0"
            tooltipText="atl03 granule region (zero means all), See section 2.5 pages 14-17 of the 'Algorithm Theoretical Basis Document'"
            tooltipUrl="https://nsidc.org/sites/default/files/documents/technical-reference/icesat2_atl03_atbd_v006.pdf"
        />
        <Fieldset legend="Time Range" class="sr-time-range-content" :toggleable="true" :collapsed="true">
            <SrCalendar
                :insensitive="!reqParamsStore.enableGranuleSelection"
                v-model="reqParamsStore.t0Value"
                label="T0"
                :getValue="reqParamsStore.getT0"
                :setValue="reqParamsStore.setT0"
                tooltipText="Start Time for filtering granules"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
            />
            <SrCalendar
                :insensitive="!reqParamsStore.enableGranuleSelection"
                v-model="reqParamsStore.t1Value"
                label="T1"
                :getValue="reqParamsStore.getT1"
                :setValue="reqParamsStore.setT1"
                tooltipText="End Time for filtering granules"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
            />
        </Fieldset>
    </div>

</template>

<style scoped>

.sr-granule-selection-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
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
:deep(.p-listbox-option) {
    padding-top: 0.125rem;
    padding-bottom: 0rem;
}
</style>