<script setup lang="ts">
import SrMenu from '@/components/SrMenu.vue';
import SrSwitchedSliderInput from '@/components/SrSwitchedSliderInput.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import SrGeoJsonFileUpload from '@/components/SrGeoJsonFileUpload.vue';
import SrResources from '@/components/SrResources.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useMapStore } from '@/stores/mapStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const mapStore = useMapStore();
const reqParamsStore = useReqParamsStore();


</script>

<template>
    <SrMenu
        v-model="mapStore.polygonSource"
        label = "Polygon Source"
        aria-label="Select Polygon Source"
        :menuOptions="mapStore.polygonSourceItems"
        :getSelectedMenuItem="useMapStore().getPolySource"
        :setSelectedMenuItem="useMapStore().setPolySource"
        tooltipText="This is how you define the region of interest"
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#polygons"
    />
    <SrGeoJsonFileUpload
        v-if="mapStore.polygonSource==='Upload geojson File'"
    />
    <SrCheckbox
        label="Ignore Poly for CMR"
        v-model="reqParamsStore.ignorePolygon"
        tooltipText="When you check this the server skips the CMR polygon search and uses the resources you specify below"
        tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/earthdata.html#cmr"
    />
    <SrResources v-if="reqParamsStore.ignorePolygon"/>
    <Fieldset class="sr-timeouts-fieldset" legend="Timeouts" :toggleable="true" :collapsed="false">
        <SrSwitchedSliderInput
            v-model="reqParamsStore.serverTimeoutValue"
            :getCheckboxValue="reqParamsStore.getUseServerTimeout"
            :setCheckboxValue="reqParamsStore.setUseServerTimeout"
            :getValue="reqParamsStore.getServerTimeout"
            :setValue="reqParamsStore.setServerTimeout"
            label="Server Timeout Override"
            :min="60"
            :max="1000000"
            :sliderMin="0"
            :sliderMax="3600"
            :defaultValue="reqParamsStore.serverTimeoutValue" 
            :decimalPlaces="0"
            tooltipText="global timeout setting that sets all timeouts at once (can be overridden by further specifying the other timeouts)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
        />
        <SrSwitchedSliderInput
            v-model="reqParamsStore.reqTimeoutValue"
            :getCheckboxValue="reqParamsStore.getUseReqTimeout"
            :setCheckboxValue="reqParamsStore.setUseReqTimeout"
            :getValue="reqParamsStore.getReqTimeout"
            :setValue="reqParamsStore.setReqTimeout"
            label="rqst-timeout"
            :min="1"
            :max="1000000" 
            :sliderMin="0"
            :sliderMax="3600"
            :decimalPlaces="0"
            tooltipText="total time in seconds for request to be processed"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
        />                    
        <SrSwitchedSliderInput
            v-model="reqParamsStore.nodeTimeoutValue"
            :getCheckboxValue="reqParamsStore.getUseNodeTimeout"
            :setCheckboxValue="reqParamsStore.setUseNodeTimeout"
            :getValue="reqParamsStore.getNodeTimeout"
            :setValue="reqParamsStore.setNodeTimeout"
            label="node-timeout"
            :min="1"
            :max="100000" 
            :sliderMin="0"
            :sliderMax="3600"
            :decimalPlaces="0"
            tooltipText="time in seconds for a single node to work on a distributed request (used for proxied requests)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
        />
        <SrSwitchedSliderInput
            v-model="reqParamsStore.readTimeoutValue"
            :getCheckboxValue="reqParamsStore.getUseReadTimeout"
            :setCheckboxValue="reqParamsStore.setUseReadTimeout"
            :getValue="reqParamsStore.getReadTimeout"
            :setValue="reqParamsStore.setReadTimeout"
            label="read-timeout"
            :min="1"
            :max="1000000" 
            :sliderMin="0"
            :sliderMax="3600"
            :decimalPlaces="0"
            tooltipText="time in seconds for a single read of an asset to take"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#timeouts"
        />
        <div class="sr-restore-timeout-defaults">
            <Button label="Restore Default Timeout behavior" @click="reqParamsStore.restoreTimeouts()"/>
        </div>  
    </Fieldset>
</template>