<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import Fieldset from 'primevue/fieldset';
import SrCalendar from './SrCalendar.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrListbox from './SrListbox.vue';
import { tracksOptions,gtsOptions,getGtsAndTracksWithGts } from '@/utils/parmUtils';
import { type SrListNumberItem } from '@/types/SrTypes';

const reqParamsStore = useReqParamsStore();
const defaultEnableGranuleSelection = () => {
    return reqParamsStore.enableGranuleSelection !== undefined ? reqParamsStore.enableGranuleSelection : false;
};
const defaultTracks = () => {
    return reqParamsStore.tracks !== undefined ? reqParamsStore.tracks : [];
};
const defaultBeams = () => {
    return reqParamsStore.beams !== undefined ? reqParamsStore.beams : [];
};
const defaultRgt = () => {
    return reqParamsStore.rgtValue !== undefined ? reqParamsStore.rgtValue : 0;
};
const defaultCycle = () => {
    return reqParamsStore.cycleValue !== undefined ? reqParamsStore.cycleValue : 0;
};
const defaultRegion = () => {
    return reqParamsStore.regionValue !== undefined ? reqParamsStore.regionValue : 0;
};
const defaultUseTime = () => {
    return reqParamsStore.useTime !== undefined ? reqParamsStore.useTime : false;
};  
const defaultT0 = () => {
    return reqParamsStore.t0Value !== undefined ? reqParamsStore.t0Value : null;
};
const defaultT1 = () => {
    return reqParamsStore.t1Value !== undefined ? reqParamsStore.t1Value : null;
};
const ccvRgt = () => {
    return reqParamsStore.getUseRgt() !== undefined ? reqParamsStore.getUseRgt() : false;
};
const ccvCycle = () => {
    return reqParamsStore.getUseCycle() !== undefined ? reqParamsStore.getUseCycle() : false;
};
const ccvRegion = () => {
    return reqParamsStore.getUseRegion() !== undefined ? reqParamsStore.getUseRegion() : false;
};

onMounted(() => {
    //console.log('Mounted SrGranuleSelection');
});

onUnmounted(() => {
    //console.log('Unmounted SrGranuleSelection');
});

const TracksSelection = (tracks:SrListNumberItem[]) => {
    console.log('TracksSelection:',tracks);
}

const GtsSelection = (gts:SrListNumberItem[]) => {
    console.log('GtsSelection:',gts);
    const parms = getGtsAndTracksWithGts(gts);
    reqParamsStore.setSelectedTrackOptions(parms.tracks);
    console.log('GtsSelection gts:',gts, ' => tracks:',reqParamsStore.tracks, ' beams:',reqParamsStore.beams);
}


</script>

<template>
    <div class="sr-granule-selection-container">
        <div class="sr-granule-selection-header">
            <SrCheckbox
                v-model="reqParamsStore.enableGranuleSelection"
                :getCheckboxValue="reqParamsStore.getEnableGranuleSelection"
                :setCheckboxValue="reqParamsStore.setEnableGranuleSelection"
                :defaultValue="defaultEnableGranuleSelection()"
                label="Granule Selection"
                labelFontSize="large"
                tooltipText="Granules are the smallest unit of data that can be independently accessed, processed, and analyzed." 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/xseries.html#granule"
            />
        </div>
        <div class="sr-granule-tracks-beams-div"> 
            <SrListbox id="beams" 
                :insensitive="!reqParamsStore.enableGranuleSelection"
                label="Beam(s)" 
                v-model="reqParamsStore.beams"
                :defaultValue="reqParamsStore.beams"
                :getSelectedMenuItem="reqParamsStore.getSelectedGtOptions"
                :setSelectedMenuItem="reqParamsStore.setSelectedGtOptions"
                :menuOptions="gtsOptions" 
                tooltipText="ATLAS laser beams are divided into three tracks of weak and strong beams"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
                @update:modelValue="GtsSelection"
            />
        </div> 
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.rgtValue"
            :getCheckboxValue="reqParamsStore.getUseRgt"
            :setCheckboxValue="reqParamsStore.setUseRgt"
            :getValue="reqParamsStore.getRgt"
            :setValue="reqParamsStore.setRgt"
            :defaultValue="defaultRgt()"
            :currentCheckboxValue="ccvRgt()"
            label="RGT"
            :min="1"
            :max="1388" 
            :decimalPlaces="0"
            tooltipText="RGT is the reference ground track: defaults to all if not specified"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
        />
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.cycleValue"
            :getCheckboxValue="reqParamsStore.getUseCycle"
            :setCheckboxValue="reqParamsStore.setUseCycle"
            :getValue="reqParamsStore.getCycle"
            :setValue="reqParamsStore.setCycle"
            :defaultValue="defaultCycle()"
            :currentCheckboxValue="ccvCycle()"
            label="Cycle"
            :min="1"
            :max="100" 
            :decimalPlaces="0"
            tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
        />
        <SrSwitchedSliderInput
            :insensitive="!reqParamsStore.enableGranuleSelection"
            v-model="reqParamsStore.regionValue"
            :getCheckboxValue="reqParamsStore.getUseRegion"
            :setCheckboxValue="reqParamsStore.setUseRegion"
            :getValue="reqParamsStore.getRegion"
            :setValue="reqParamsStore.setRegion"
            :defaultValue="defaultRegion()"
            :currentCheckboxValue="ccvRegion()"
            label="Atl03 Granule Region"
            :min="1"
            :max="14" 
            :decimalPlaces="0"
            tooltipText="atl03 granule region (zero means all), See section 2.5 pages 14-17 of the 'Algorithm Theoretical Basis Document'"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
        />
        <Fieldset legend="Time Range" class="sr-time-range-content" :toggleable="true" :collapsed="false">
            <SrCheckbox
                :insensitive="!(reqParamsStore.enableGranuleSelection)"
                v-model="reqParamsStore.useTime"
                :getCheckboxValue="reqParamsStore.getUseTime"
                :setCheckboxValue="reqParamsStore.setUseTime"
                :defaultValue="defaultUseTime()"
                label="Use Time Filter"
                labelFontSize="large"
                tooltipText="Filter granules by time" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
            />
            <SrCalendar
                :insensitive="!(reqParamsStore.enableGranuleSelection && reqParamsStore.useTime)"
                v-model="reqParamsStore.t0Value"
                label="T0"
                :getValue="reqParamsStore.getT0"
                :setValue="reqParamsStore.setT0"
                :defaultValue="defaultT0()"
                tooltipText="Start Time for filtering granules"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
            />
            <SrCalendar
                :insensitive="!(reqParamsStore.enableGranuleSelection && reqParamsStore.useTime)"
                v-model="reqParamsStore.t1Value"
                label="T1"
                :getValue="reqParamsStore.getT1"
                :setValue="reqParamsStore.setT1"
                :defaultValue="defaultT1()"
                tooltipText="End Time for filtering granules"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-input-parameters"
            />
        </Fieldset>
    </div>

</template>

<style scoped>

.sr-granule-selection-container {
    padding: 0.75rem;
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