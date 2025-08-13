<script setup lang="ts">
import SrUploadRegion from '@/components/SrUploadRegion.vue';
import SrMenu from '@/components/SrMenu.vue';
import SrSwitchedSliderInput from '@/components/SrSwitchedSliderInput.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import SrGeoJsonFileUpload from '@/components/SrGeoJsonFileUpload.vue';
import SrResources from '@/components/SrResources.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import SrShapefileUpload from '@/components/SrShapefileUpload.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useMapStore } from '@/stores/mapStore';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { onMounted } from 'vue';
import type { Feature as OLFeature } from "ol";
import type { Geometry } from "ol/geom";
import { Map as OLMapType} from "ol";
import { Layer as OLlayer } from 'ol/layer';



const mapStore = useMapStore();
const reqParamsStore = useReqParamsStore();


function onShapefileFeatures(features: OLFeature<Geometry>[]) {

    const map = mapStore.getMap() as OLMapType;
    if (map) {
        const vectorLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'Uploaded Features');
        if(vectorLayer && vectorLayer instanceof OLlayer){
            const vectorSource = vectorLayer.getSource();
            if(vectorSource){
                vectorSource.addFeatures(features);
            }
        } else {
            console.error('Vector layer not found or is not a VectorLayer');
            // Handle the case where the vector layer is not found or is not a VectorLayer
        }
    }
}
onMounted(async () => {
    // Initialize any required state or fetch data if needed
    await reqParamsStore.restoreTimeouts();
});

</script>

<template>
    <div class="sr-gen-user-options-container">
        <SrUploadRegion />
        <SrMenu
            v-model="mapStore.polygonSource"
            label = "Polygon Source"
            aria-label="Select Polygon Source"
            :menuOptions="mapStore.polygonSourceItems"
            :getSelectedMenuItem="useMapStore().getPolySource"
            :setSelectedMenuItem="useMapStore().setPolySource"
            tooltipText="This is how you define the region of interest"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#polygons"
        />
        <SrGeoJsonFileUpload
            v-if="mapStore.polygonSource==='GeoJSON File'"
            :loadReqPoly="true"
            :reportUploadProgress="true"
        />
        <SrSliderInput
            v-if="mapStore.polygonSource==='GeoJSON File'"
            label="Rasterize Polygon cell size"
            unitsLabel="Degrees"
            v-model="reqParamsStore.rasterizePolyCellSize"
            :getValue="reqParamsStore.getRasterizePolyCellSize"
            :setValue="reqParamsStore.setRasterizePolyCellSize"
            :min="0.0001"
            :max="1.0"
            :decimalPlaces="4"
            tooltipText="The number of pixels to rasterize the polygon into"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#rasterized-area-of-interest"
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
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
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
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
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
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
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
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/basic_usage.html#timeouts"
            />
            <div class="sr-restore-timeout-defaults">
                <Button label="Restore Default Timeout behavior" @click="reqParamsStore.restoreTimeouts()"/>
            </div>  
        </Fieldset>
        <div class="sr-upload-geojson-container">
            <label class="sr-gj-label">{{ "Upload GeoJSON map features" }}</label>
            <SrGeoJsonFileUpload 
                :reportUploadProgress="true"
            />
        </div>
        <div class="sr-upload-shapefile-container">
            <label class="sr-gj-label">{{ "Upload Shapefile map features" }}</label>
            <SrShapefileUpload @features="onShapefileFeatures"/>
        </div>
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