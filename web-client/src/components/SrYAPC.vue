<script setup lang="ts">
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckBox from './SrCheckbox.vue';
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
  <div class="sr-yapc-container">
    <div class="sr-yapc-header">
      <SrLabelInfoIconButton v-if="label != ''" label="YAPC" tooltipText="The experimental YAPC (Yet Another Photon Classifier) photon-classification scheme." tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification" :insensitive="insensitive" labelFontSize="large"/>
      <SrCheckBox
          v-model="reqParamsStore.YAPC"
          label=""
          :min="1"
          :max="100" 
          :decimalPlaces="0"
      />
    </div>
    <div class="sr-yapc-version-header">
      <SrMenuInput
          v-model="reqParamsStore.YAPCVersion"
          :selected="reqParamsStore.usesYAPCVersion"
          label = "Version"
          aria-label="Select Version"
          :menuOptions="reqParamsStore.YAPCVersionOptions"
          :insensitive="!reqParamsStore.YAPC"
          :default="[reqParamsStore.YAPCVersionOptions[0]]"
          tooltipText="The version of the YAPC algorithm to use."
          tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
      />
    </div>
    <SrSliderInput
        v-model="reqParamsStore.YAPCScore"
        label="Score"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCKnn"
        :selected="!reqParamsStore.usesYAPCKnn"
        label="Knn"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
        tooltipText="The number of nearest neighbors to use in the Knn algorithm."
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowHeight"
        :selected="reqParamsStore.usesYAPCWindowHeight"
        label="Window Height"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"  
        :insensitive="!reqParamsStore.YAPC"
        tooltipText="The window height used to filter the nearest neighbors"
        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#yapc-classification"
   />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowWidth"
        :selected="reqParamsStore.usesYAPCWindowWidth"
        label="Window Width"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
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
  border-radius: var(--border-radius);
}

.sr-yapc-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}

.sr-yapc-version-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
}
:deep(.sr-yapc-header .sr-checkbox-label){
    font-size: large;
}
</style>