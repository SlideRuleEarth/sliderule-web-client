<script setup lang="ts">
import SrMenuMultiInput from './SrMultiSelect.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>

<template>
    <div class = "sr-atl08-cnf-container">
        <div class="sr-atl08-cnf-header">
            <SrCheckbox
                label="Atl08 Confidence"
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
:deep(.sr-atl08-cnf-header .sr-checkbox-label){
    font-size: large;
}
</style>