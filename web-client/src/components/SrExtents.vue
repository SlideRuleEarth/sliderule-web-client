<script setup lang="ts">

import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import { onMounted } from 'vue';
import { distanceInOptions } from '@/types/SrStaticOptions';

const reqParamsStore = useReqParamsStore();

onMounted(() => {
    const len = useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'len');
    //console.log(`SrExtents mounted for mission ${reqParamsStore.missionValue} with default len=${len}`);
    if(len){
        reqParamsStore.setLengthValue(len);
    } else {
        console.warn(`No default length found for mission ${reqParamsStore.missionValue}`);
    }
    const res = useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'res');
    if(res){
        reqParamsStore.setStepValue(res);
    } else {
        console.warn(`No default step size found for mission ${reqParamsStore.missionValue}`);
    }
    const ats = useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'ats');
    if (ats) {
        reqParamsStore.setAlongTrackSpread(ats);
    } else {
        console.warn(`No default along-track spread found for mission ${reqParamsStore.missionValue}`);
    }
    const cnt = useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'cnt');
    if (cnt) {
        reqParamsStore.setMinimumPhotonCount(cnt);
    } else {
        console.warn(`No default minimum photon count found for mission ${reqParamsStore.missionValue}`);
    }
});

</script>
<template>
    <div class="sr-extents-container">
        <div class="sr-extents-top-header">
            <span class="sr-extents-hdr">Extents</span>
        </div>
        <div class="sr-ext-distance-container">
            <div class="sr-ext-distance-header-container">
                <SrMenuInput
                        v-model="reqParamsStore.distanceIn"
                        label = "Distance In"
                        labelFontSize="large"
                        :justify_center='false'
                        aria-label="Select Distance in"
                        :menuOptions="distanceInOptions"
                        tooltipText="Distance in meters or segments"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
                </div>
            <div class="sr-ext-distance-body-container">
                <SrSwitchedSliderInput
                    v-if="reqParamsStore.distanceIn.value==='meters'"
                    v-model="reqParamsStore.lengthValue"
                    label="Length in meters"
                    :getCheckboxValue="reqParamsStore.getUseLength"
                    :setCheckboxValue="reqParamsStore.setUseLength"
                    :getValue="reqParamsStore.getLengthValue"
                    :setValue="reqParamsStore.setLengthValue"
                    :min="1"
                    :max="200" 
                    :decimal-places="0"                  
                    tooltipText="len: The length of the extent in meters"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
                <SrSwitchedSliderInput
                    v-if="reqParamsStore.distanceIn.value==='meters'"
                    v-model="reqParamsStore.stepValue"
                    label="Step Size (meters)"
                    :getCheckboxValue="reqParamsStore.getUseStep"
                    :setCheckboxValue="reqParamsStore.setUseStep"
                    :getValue="reqParamsStore.getStepValue"
                    :setValue="reqParamsStore.setStepValue"
                    :min="1"
                    :max="100" 
                    :decimal-places="0"
                    tooltipText="res: The Step Size of the extent in meters"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
                <SrSwitchedSliderInput
                    v-if="reqParamsStore.distanceIn.value==='segments'"
                    v-model="reqParamsStore.lengthValue"
                    label="Length in segments"
                    :getCheckboxValue="reqParamsStore.getUseLength"
                    :setCheckboxValue="reqParamsStore.setUseLength"
                    :getValue="reqParamsStore.getLengthValue"
                    :setValue="reqParamsStore.setLengthValue"
                    :min="1"
                    :max="200" 
                    :decimal-places="0"                  
                    tooltipText="len: The length of the extent in segments"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
                <SrSwitchedSliderInput
                    v-if="reqParamsStore.distanceIn.value==='segments'"
                    v-model="reqParamsStore.stepValue"
                    label="Step Size (segments)"
                    :getCheckboxValue="reqParamsStore.getUseStep"
                    :setCheckboxValue="reqParamsStore.setUseStep"
                    :getValue="reqParamsStore.getStepValue"
                    :setValue="reqParamsStore.setStepValue"
                    :min="1"
                    :max="100" 
                    :decimal-places="0"
                    tooltipText="res: The length of the extent in segments"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
            </div>
        </div>  
        <div class="sr-pass-invalid-container">
            <div class="sr-pass-invalid-header-container">
                <SrCheckbox
                    label="Pass Invalid"
                    labelFontSize="large"
                    v-model="reqParamsStore.passInvalid"
                    tooltipText="pass_invalid: indicating whether or not extents that fail validation checks are still used and returned in the results" 
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
            </div> 
            <div class="sr-pass-invalid-body-container">
                <SrSwitchedSliderInput
                    :insensitive="(reqParamsStore.passInvalid)"
                    v-model="reqParamsStore.alongTrackSpread"
                    label="Along Track Spread"
                    :getCheckboxValue="reqParamsStore.getUseAlongTrackSpread"
                    :setCheckboxValue="reqParamsStore.setUseAlongTrackSpread"
                    :getValue="reqParamsStore.getAlongTrackSpread"
                    :setValue="reqParamsStore.setAlongTrackSpread"
                    :min="0"
                    :max="200" 
                    :decimal-places="0"
                    tooltipText="ats: minimum along track spread"
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
                <SrSwitchedSliderInput
                    :insensitive="(reqParamsStore.passInvalid)"
                    v-model="reqParamsStore.minimumPhotonCount"
                    label="Minimum Photon Count"
                    :getCheckboxValue="reqParamsStore.getUseMinimumPhotonCount"
                    :setCheckboxValue="reqParamsStore.setUseMinimumPhotonCount"
                    :getValue="reqParamsStore.getMinimumPhotonCount"
                    :setValue="reqParamsStore.setMinimumPhotonCount"
                    :min="0"
                    :max="200" 
                    :decimal-places="0"
                    tooltipText="cnt: minimum photon count in segments"
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#photon-extent-parameters"
                />
            </div> 
        </div>
    </div>
</template>
<style scoped>


.sr-extents-container{
    display: flex;
    flex-direction: column;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
    align-items: center;
    justify-content: space-between;
    background-color: transparent;
}
.sr-extents-top-header{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1.5rem;
}
.sr-extents-hdr{
    font-size: large;
    font-weight: bold;
}
.sr-ext-distance-container{
    display: flex;
    flex-direction: column;
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
    margin-bottom: 1rem;
    padding: 0.5rem;
    align-items: center;
    justify-content: space-between;
}

.sr-ext-distance-header-container{
    display: flex;
    flex-direction: column;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
    gap: 0.5rem;
    padding:0.25rem;

}

.sr-ext-distance-body-container{
    display: flex;
    flex-direction: column;
    justify-content: space-between; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}

.sr-pass-invalid-container{
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
    padding: 0.25rem;
    gap:0.25rem;
}
.sr-pass-invalid-header-container{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 0.5rem;
    padding: 0.25rem;
}
:deep(.sr-pass-invalid-header-container .sr-checkbox-label){
    font-size: large;
}
:deep(.sr-ext-distance-header-container .sr-select-menu-label){
    font-size: large;
}

.sr-pass-invalid-body-container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
    gap: 0.5rem; /* or whatever spacing you want */
}
</style>