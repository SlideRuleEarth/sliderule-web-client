<script setup lang="ts">
import SrMultiSelectText from './SrMultiSelectText.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>

<template>
    <div class = "sr-atl08-cnf-container">
        <div class="sr-atl08-cnf-header">
            <SrCheckbox
                label="Atl08 Classification"
                labelFontSize="large"
                v-model="reqParamsStore.enableAtl08Classification"
                tooltipText="If ATL08 classification parameters are specified, the ATL08 (vegetation height) files corresponding to the ATL03 files are queried for the more advanced classification scheme available in those files. Photons are then selected based on the classification values specified. Note that srt=0 (land) and cnf=0 (no native filtering) should be specified to allow all ATL08 photons to be used."
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl08-classification"
             />
        </div>
        <SrMultiSelectText
            v-model="reqParamsStore.atl08LandType"
            label = "Land Type(s)"
            aria-label="Select Land Type"
            :menuOptions="reqParamsStore.atl08LandTypeOptions"
            :insensitive="!reqParamsStore.enableAtl08Classification"
            :default="[
                {name:'Ground', value: 'atl08_ground'},
                {name:'Canopy', value:'atl08_canopy'},
                {name:'Top of Canopy', value:'atl08_top_of_canopy'},
            ]"
            tooltipText="atl08_class: The ATL08 classifications used to select which photons are used in the processing."
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl08-classification"
        />

    </div>
</template>
<style scoped>

.sr-atl08-cnf-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
}

.sr-atl08-cnf-header {
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}
</style>