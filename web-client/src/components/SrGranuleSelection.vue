<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import SrMenuMultiInput from './SrMenuMultiInput.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrCalendar from './SrCalendar.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';


const reqParamsStore = useReqParamsStore();

onMounted(() => {
    console.log('Mounted SrGranuleSelection');
});
onUnmounted(() => {
    console.log('Unmounted SrGranuleSelection');
});


const { selectAllTracks, tracks } = storeToRefs(reqParamsStore);

const updateSelectAllTracks = (value: boolean) => {
  reqParamsStore.setSelectAllTracks(value);
};

const updateTracks = (items: string[]) => {
  reqParamsStore.setTracks(items);
};

</script>

<template>
    <div class="sr-granule-selection">
        <SrMenuMultiInput
            v-model:selectedMenuItems="tracks"
            v-model:selectAll="selectAllTracks"
            @update:selectAll="updateSelectAllTracks"
            @update:selectedMenuItems="updateTracks"
            label = "Track(s)"
            aria-label="Select Tracks"
            :menuOptions="reqParamsStore.tracksOptions"
            :default="reqParamsStore.tracksOptions"
            tooltipText="Each track has both a weak and a strong spot"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
        />
        <SrMenuMultiInput
            v-model="reqParamsStore.beams"
            label = "Beam(s)"
            aria-label="Select Beams"
            :menuOptions="reqParamsStore.beamsOptions"
            :default="reqParamsStore.beamsOptions"
            tooltipText="Weak and strong spots are determined by orientation of the satellite"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
        />
        <SrSwitchedSliderInput
            v-model="reqParamsStore.rgtValue"
            label="RGT"
            :min="1"
            :max="10000" 
            :decimalPlaces="0"
            tooltipText="RGT is the reference ground track: defaults to all if not specified"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSliderInput
            v-model="reqParamsStore.cycleValue"
            label="Cycle"
            :min="1"
            :max="100" 
            :decimalPlaces="0"
            tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrSliderInput
            v-model="reqParamsStore.regionValue"
            label="Region"
            :min="1"
            :max="100" 
            :decimalPlaces="0"
            tooltipText="geographic region for corresponding standard product (defaults to all if not specified)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrCalendar
            v-model="reqParamsStore.t0Value"
            label="T0"
            tooltipText="Start Time for filtering granules"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />
        <SrCalendar
            v-model="reqParamsStore.t1Value"
            label="T1"
            tooltipText="End Time for filtering granules"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
        />

    </div>

</template>