<script setup lang="ts">
import SrMenuMultiInput from './SrMultiSelect.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();
const props = defineProps({
    label: String,
    insensitive: {
            type: Boolean,
            default: false
        },
    });
</script>

<template>
    <div class = "sr-atl08-cnf-container">
        <div class="sr-atl08-cnf-header">
            <SrLabelInfoIconButton v-if="label != ''" label="Atl08 Classification" tooltipText="If ATL08 classification parameters are specified, the ATL08 (vegetation height) files corresponding to the ATL03 files are queried for the more advanced classification scheme available in those files" tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl08-classification" :insensitive="insensitive" labelFontSize="large"/>
            <SrCheckbox
                label=""
                v-model="reqParamsStore.enableAtl08Confidence"
            />
        </div>
        <SrMenuMultiInput
            v-model="reqParamsStore.landType"
            label = "Land Type(s)"
            aria-label="Select Land Type"
            :menuOptions="reqParamsStore.landTypeOptions"
            :insensitive="!reqParamsStore.enableAtl08Confidence"
            :default="[reqParamsStore.landTypeOptions[0]]"
        />

    </div>
</template>
<style scoped>

.sr-atl08-cnf-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--border-radius);
}

.sr-atl08-cnf-header {
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}
</style>