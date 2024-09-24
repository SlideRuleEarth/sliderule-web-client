<script setup lang="ts">
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrMenu from './SrMenu.vue';
import SrCheckBox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>

<template>
  <div class="sr-yapc-container">
    <div class="sr-yapc-header">
      <SrCheckBox
          v-model="reqParamsStore.enableYAPC"
          label="YAPC" 
          tooltipText="The experimental YAPC (Yet Another Photon Classifier) photon-classification scheme." 
          tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification" 
          labelFontSize="large"          
      />
    </div>
    <div class="sr-yapc-version-header">
      <SrMenu
          v-model="reqParamsStore.YAPCVersion"
          :selected="reqParamsStore.usesYAPCVersion"
          label = "Version"
          aria-label="Select Version"
          :menuOptions="reqParamsStore.YAPCVersionOptions"
          :getSelectedMenuItem="reqParamsStore.getYAPCVersion"
          :setSelectedMenuItem="reqParamsStore.setYAPCVersion"
          :insensitive="!reqParamsStore.enableYAPC"
          tooltipText="The version of the YAPC algorithm to use."
          tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
      />
    </div>
    <SrSliderInput
        label="Score"
        v-model="reqParamsStore.YAPCScore"
        :getCheckboxValue="reqParamsStore.getUseYAPCScore"
        :setCheckboxValue="reqParamsStore.setUseYAPCScore"
        :getValue="reqParamsStore.getYAPCScore"
        :setValue="reqParamsStore.setYAPCScore"
        :min="0"
        :max="255" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.enableYAPC"
        tooltipText="The minimum yapc classification score of a photon to be used in the processing request"
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
    />
    <SrSwitchedSliderInput
        label="Knn"
        v-model="reqParamsStore.YAPCKnn"
        :getCheckboxValue="reqParamsStore.getUseYAPCKnn"
        :setCheckboxValue="reqParamsStore.setUseYAPCKnn"
        :getValue="reqParamsStore.getYAPCKnn"
        :setValue="reqParamsStore.setYAPCKnn"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.enableYAPC"
        tooltipText="The number of nearest neighbors to use in the Knn algorithm."
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
    />
    <SrSwitchedSliderInput
        label="Window Height"
        v-model="reqParamsStore.YAPCWindowHeight"
        :getCheckboxValue="reqParamsStore.getUsesYAPCWindowHeight"
        :setCheckboxValue="reqParamsStore.setUsesYAPCWindowHeight"
        :getValue="reqParamsStore.getYAPCWindowHeight"
        :setValue="reqParamsStore.setYAPCWindowHeight"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"  
        :insensitive="!reqParamsStore.enableYAPC"
        tooltipText="The window height used to filter the nearest neighbors"
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
   />
    <SrSwitchedSliderInput
        label="Window Width"
        v-model="reqParamsStore.YAPCWindowWidth"
        :getCheckboxValue="reqParamsStore.getUsesYAPCWindowWidth"
        :setCheckboxValue="reqParamsStore.setUsesYAPCWindowWidth"
        :getValue="reqParamsStore.getYAPCWindowWidth"
        :setValue="reqParamsStore.setYAPCWindowWidth"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.enableYAPC"
        tooltipText="The window width used to filter the nearest neighbors"
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
    />
  </div>
</template>
<style scoped>

.sr-yapc-container {
  margin-bottom: 1rem;
  padding: 0.25rem;
  border: 1px solid grey;
  border-radius: var(--p-border-radius);
}

.sr-yapc-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}

.sr-yapc-version-header {
  display: inline-flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
}
:deep(.sr-yapc-header .sr-checkbox-label){
    font-size: large;
}
</style>