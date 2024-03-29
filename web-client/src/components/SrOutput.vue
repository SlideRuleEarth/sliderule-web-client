<script setup lang="ts">
import SrMenuInput from './SrMenuInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrTextInput from './SrTextInput.vue';
import SrCredsFileUpload from './SrCredsFileUpload.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();
</script>

<template>
    <div class = "sr-output-container">
        <div class="sr-output-header">
            <SrCheckbox
                label="Save Output"
                v-model="reqParamsStore.saveOutput"
            />
        </div>
        <SrCheckbox
            :insensitive = "!reqParamsStore.saveOutput"
            label="Staged"
            v-model="reqParamsStore.staged"
        />
        <SrMenuInput
            :insensitive = "!reqParamsStore.saveOutput"
            v-model="reqParamsStore.outputFormat"
            label = "Output Format"
            aria-label="Select Output Format"
            :menuOptions="reqParamsStore.outputFormatOptions"
        />
        <SrMenuInput
            :insensitive = "!reqParamsStore.saveOutput || reqParamsStore.staged===true"
            v-model="reqParamsStore.outputLocation"
            label = "Output Location"
            aria-label="Select Output Location"
            :menuOptions="reqParamsStore.outputLocationOptions"
        />
        <SrTextInput
            :insensitive = "!reqParamsStore.saveOutput || reqParamsStore.staged===true"
            v-model="reqParamsStore.outputLocationPath"
            label = "Output Location Path"
            aria-label="Enter Output Location Path"
        />
        <SrMenuInput
            :insensitive = "!reqParamsStore.saveOutput || reqParamsStore.staged===true"
            v-model="reqParamsStore.awsRegion"
            label = "AWS Region"
            aria-label="Select AWS Region"
            :menuOptions="reqParamsStore.awsRegionOptions"
        />
        <SrCredsFileUpload
            :insensitive = "!reqParamsStore.saveOutput || reqParamsStore.staged===true"
        />
    </div>
</template>
<style scoped>



.sr-output-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--border-radius);
}
.sr-output-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}

:deep(.sr-output-header .sr-checkbox-label){
    font-size: large;
}

</style>