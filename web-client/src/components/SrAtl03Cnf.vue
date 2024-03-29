<script setup lang="ts">
import SrMenuInput from './SrMenuInput.vue';
import SrMultiSelect from './SrMultiSelect.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>

<template>
    <div class = "sr-atl03-cnf-container">
        <div class="sr-atl03-cnf-header">
            <SrCheckbox
                label="Atl03 Confidence"
                v-model="reqParamsStore.enableAtl03Confidence"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrMultiSelect
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Surface Reference Type"
                ariaLabel="Select Reference Surface Type"
                :menuOptions="reqParamsStore.surfaceReferenceTypeOptions"
                @update:value="reqParamsStore.surfaceReferenceType = $event"
                :default="[reqParamsStore.surfaceReferenceTypeOptions[0]]"
            />
            <SrMenuInput
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Signal Confidence"
                ariaLabel="Signal Confidence"
                :menuOptions="reqParamsStore.signalConfidenceOptions"
                defaultOptionIndex="2"
                @update:value="reqParamsStore.signalConfidence = $event"
            />
        </div>
    </div>
</template>
<style scoped>


.sr-atl03-cnf-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--border-radius);
}
.sr-atl03-cnf-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}
</style>