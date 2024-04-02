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
                tooltipText='By default, SlideRule returns all results in a native (i.e. custom to SlideRule) format that is streamed back to the client and used by the client to construct a GeoDataFrame that is returned to the user. Using the parameters below, SlideRule can build the entire DataFrame of the results on the servers, in one of a few different formats (currently, only GeoParquet GeoParquet is supported), and return the results as a file that is streamed back to the client and reconstructed by the client. To control this behavior, the "output" parameter is used.Optionally, SlideRule supports writing the output to an S3 bucket instead of streaming the output back to the client. In order to enable this behavior, the "output.path" field must start with “s3://” followed by the bucket name and object key. For example, if you wanted the result to be written to a file named “grandmesa.parquet” in your S3 bucket “mybucket”, in the subfolder “maps”, then the output.path would be “s3://mybucket/maps/grandmesa.parquet”. When writing to S3, it is required by the user to supply the necessary credentials. This can be done in one of two ways: (1) the user specifies an “asset” supported by SlideRule for which SlideRule already maintains credentials; (2) the user specifies their own set of temporary aws credentials.'
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#output-parameters"
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
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
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