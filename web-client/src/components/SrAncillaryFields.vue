<template>
<div class="sr-ancillary-fields-container">
    <SrMenuMultiInputText
    :insensitive="true"
        v-if="props.iceSat2SelectedAPI === 'atl03sp' || props.iceSat2SelectedAPI.includes('atl06')"
        v-model="reqParamsStore.ATL03GeoSpatialFieldsOptions"
        label="ATL03 GeoSpatial Fields"
        ariaLabel="Select ATL03 GeoSpatial Fields"
        labelFontSize="large"
        :menuOptions="reqParamsStore.ATL03GeoSpatialFieldsOptions"
        :default="reqParamsStore.ATL03GeoSpatialFieldsOptions"
        tooltipText='Fields in the “geolocation” and “geophys_corr” groups of the ATL03 granule'
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#ancillary-field-parameters"
    />  
    <SrMenuMultiInputText
    :insensitive="true"
        v-if="props.iceSat2SelectedAPI === 'atl03sp' || props.iceSat2SelectedAPI.includes('atl06')"
        v-model="reqParamsStore.ATL03PhotonFieldsOptions"
        label="ATL03 Photon Fields"
        ariaLabel="Select ATL03 Photon Fields"
        labelFontSize="large"
        :menuOptions="reqParamsStore.ATL03PhotonFieldsOptions"
        :default="reqParamsStore.ATL03PhotonFieldsOptions"
        tooltipText='Fields in the "heights"  groups of the ATL03 granule'
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#ancillary-field-parameters"
    /> 
    <SrMenuMultiInputText
    :insensitive="true"
        v-if="props.iceSat2SelectedAPI==='atl06s'"
        v-model="reqParamsStore.ATL06IceSegmentFieldsOptions"
        label="ATL03 IceSegment Fields"
        ariaLabel="Select ATL03 IceSegment Fields"
        labelFontSize="large"
        :menuOptions="reqParamsStore.ATL06IceSegmentFieldsOptions"
        :default="reqParamsStore.ATL06IceSegmentFieldsOptions"
        tooltipText='Fields in the "land_ice_segments"  groups of the ATL06 granule'
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#ancillary-field-parameters"
    />  
    <SrMenuMultiCheckInput
    :insensitive="true"
        v-if="props.iceSat2SelectedAPI.includes('atl08')"
        v-model="reqParamsStore.ATL08LandSegmentFieldsOptions"
        label="ATL08 LandSegment Fields"
        additionalParamLabel="interpolate"
        ariaLabel="Select ATL08 LandSegment Fields"
        labelFontSize="large"
        :menuOptions="reqParamsStore.ATL08LandSegmentFieldsOptions"
        :default="reqParamsStore.ATL08LandSegmentFieldsOptions"
        tooltipText='Fields in the "land_segments"  groups of the ATL06 granule'
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#ancillary-field-parameters"
    /> 
</div> 
</template>
<script setup lang="ts">
import SrMenuMultiInputText from './SrMenuMultiInputText.vue';
import SrMenuMultiCheckInput from './SrMenuMultiCheckInput.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

interface Props {
  iceSat2SelectedAPI: string;
}

const props = defineProps<Props>();


</script>

<style scoped>
.sr-ancillary-fields-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0rem;
    padding: 0rem;
    margin-bottom: 0;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
}
</style>
