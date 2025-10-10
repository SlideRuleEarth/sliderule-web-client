<script setup lang="ts">
import SrSwitchedSliderInput from '@/components/SrSwitchedSliderInput.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import SrResources from '@/components/SrResources.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { onMounted } from 'vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';



//const mapStore = useMapStore();
const reqParamsStore = useReqParamsStore();
const defaultValServerTimeout = () => {
    const value = useSlideruleDefaults().getNestedDefault<number>('core', 'timeout');
    console.log('SrGenUserOptions: defaultValServerTimeout:', value);
    if(value === undefined || value === null || value <= 0) {
        console.error('SrGenUserOptions: defaultValServerTimeout is undefined or null, or <= 0:', value);
        return 0; // default to 0 seconds if no valid default
    }
    return value;
};

const defaultValRqstTimeout = () => {
    const value = useSlideruleDefaults().getNestedDefault<number>('core', 'rqst_timeout');
    console.log('SrGenUserOptions: defaultValRequestTimeout:', value);
    if(value === undefined || value === null || value <= 0) {
        console.error('SrGenUserOptions: defaultValRequestTimeout is undefined or null, or <= 0:', value);
        return 0; // default to 0 seconds if no valid default
    }
    return value;
};

const defaultValNodeTimeout = () => {
    const value = useSlideruleDefaults().getNestedDefault<number>('core', 'node_timeout');
    console.log('SrGenUserOptions: defaultValNodeTimeout:', value);
    if(value === undefined || value === null || value <= 0) {
        console.error('SrGenUserOptions: defaultValNodeTimeout is undefined or null, or <= 0:', value);
        return 0; // default to 0 seconds if no valid default
    }
    return value;
};

const defaultValReadTimeout = () => {
    const value = useSlideruleDefaults().getNestedDefault<number>('core', 'read_timeout');
    console.log('SrGenUserOptions: defaultValReadTimeout:', value);
    if(value === undefined || value === null || value <= 0) {
        console.error('SrGenUserOptions: defaultValReadTimeout is undefined or null, or <= 0:', value);
        return 0; // default to 0 seconds if no valid default
    }
    return value;
};

const ccvServerTimeout = () => { // current checkbox value
    return reqParamsStore.useServerTimeout !== undefined ? reqParamsStore.useServerTimeout : false;
};

const ccvRqstTimeout = () => {
    return reqParamsStore.useReqTimeout !== undefined ? reqParamsStore.useReqTimeout : false;
};

const ccvNodeTimeout = () => {
    return reqParamsStore.useNodeTimeout !== undefined ? reqParamsStore.useNodeTimeout : false;
};

const ccvReadTimeout = () => {
    return reqParamsStore.useReadTimeout !== undefined ? reqParamsStore.useReadTimeout : false;
};

onMounted(async () => {
 
});

</script>

<template>
    <div class="sr-gen-user-options-container">
        <SrCheckbox
            label="as GeoParquet"
            v-model="reqParamsStore.isGeoParquet"
            tooltipText="When you check this the server will return the data in GeoParquet format"
            tooltipUrl="https://geoparquet.org/"
        />
        <SrCheckbox
            label="Specify Resources (no CMR polygon search)"
            v-model="reqParamsStore.ignorePolygon"
            tooltipText="When you check this the server skips the CMR polygon search and uses the resources you specify below"
            tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/earthdata.html#cmr"
        />

        <SrResources v-if="reqParamsStore.ignorePolygon"/>
        <Fieldset class="sr-timeouts-fieldset" legend="Timeouts" :toggleable="true" :collapsed="false">
            <SrSwitchedSliderInput
                v-model="reqParamsStore.serverTimeoutValue"
                label="Server Timeout Override"
                :getCheckboxValue="reqParamsStore.getUseServerTimeout"
                :setCheckboxValue="reqParamsStore.setUseServerTimeout"
                :getValue="reqParamsStore.getServerTimeout"
                :setValue="reqParamsStore.setServerTimeout"
                :defaultValue="defaultValServerTimeout()"
                :currentCheckboxValue="ccvServerTimeout()"
                :inputId="'sr-server-timeout'"
                :min="60"
                :max="1000000"
                :sliderMin="0"
                :sliderMax="3600"
                :decimalPlaces="0"
                tooltipText="global timeout setting that sets all timeouts at once (can be overridden by further specifying the other timeouts)"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
            />
            <SrSwitchedSliderInput
                v-model="reqParamsStore.reqTimeoutValue"
                label="rqst-timeout"
                :getCheckboxValue="reqParamsStore.getUseReqTimeout"
                :setCheckboxValue="reqParamsStore.setUseReqTimeout"
                :getValue="reqParamsStore.getReqTimeout"
                :setValue="reqParamsStore.setReqTimeout"
                :defaultValue="defaultValRqstTimeout()"
                :currentCheckboxValue="ccvRqstTimeout()"
                :inputId="'sr-rqst-timeout'"
                :min="1"
                :max="1000000" 
                :sliderMin="0"
                :sliderMax="3600"
                :decimalPlaces="0"
                tooltipText="total time in seconds for request to be processed"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
            />                    
            <SrSwitchedSliderInput
                v-model="reqParamsStore.nodeTimeoutValue"
                label="node-timeout"
                :getCheckboxValue="reqParamsStore.getUseNodeTimeout"
                :setCheckboxValue="reqParamsStore.setUseNodeTimeout"
                :getValue="reqParamsStore.getNodeTimeout"
                :setValue="reqParamsStore.setNodeTimeout"
                :defaultValue="defaultValNodeTimeout()"
                :currentCheckboxValue="ccvNodeTimeout()"
                :inputId="'sr-node-timeout'"
                :min="1"
                :max="100000" 
                :sliderMin="0"
                :sliderMax="3600"
                :decimalPlaces="0"
                tooltipText="time in seconds for a single node to work on a distributed request (used for proxied requests)"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
            />
            <SrSwitchedSliderInput
                v-model="reqParamsStore.readTimeoutValue"
                label="read-timeout"
                :getCheckboxValue="reqParamsStore.getUseReadTimeout"
                :setCheckboxValue="reqParamsStore.setUseReadTimeout"
                :getValue="reqParamsStore.getReadTimeout"
                :setValue="reqParamsStore.setReadTimeout"
                :defaultValue="defaultValReadTimeout()"
                :currentCheckboxValue="ccvReadTimeout()"
                :inputId="'sr-read-timeout'"
                :min="1"
                :max="1000000" 
                :sliderMin="0"
                :sliderMax="3600"
                :decimalPlaces="0"
                tooltipText="time in seconds for a single read of an asset to take"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
            />
            <div class="sr-restore-timeout-defaults">
                <Button label="Restore Default Timeout behavior" @click="reqParamsStore.restoreTimeouts()"/>
            </div>  
        </Fieldset>
        <!-- <div class="sr-upload-geojson-container">
            <label class="sr-gj-label">{{ "Upload GeoJSON map features" }}</label>
            <SrGeoJsonFileUpload 
                :reportUploadProgress="true"
            />
        </div>
        <div class="sr-upload-shapefile-container">
            <label class="sr-gj-label">{{ "Upload Shapefile map features" }}</label>
            <SrShapefileUpload @features="onShapefileFeatures"/>
        </div> -->
     </div>  
</template>
<style scoped>
.sr-gen-user-options-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0.5rem;
    gap:0.75rem;
}
.sr-upload-geojson-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0.5rem;
    gap: 0.5rem;
}
.sr-gj-label {
    font-weight: bold;
    margin-bottom: 0.5rem;
}
.sr-upload-shapefile-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0.5rem;
    gap: 0.5rem;
}
</style>