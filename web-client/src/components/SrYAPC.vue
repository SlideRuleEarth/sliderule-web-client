<script setup lang="ts">
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrMenu from './SrMenu.vue';
import SrCheckBox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
import { onMounted } from 'vue';
import { YAPCVersionOptions } from '@/types/SrStaticOptions';

const reqParamsStore = useReqParamsStore();

onMounted(async () => {
  await reqParamsStore.initYapcDefaults();
});

async function initYapc(){
  //console.log('initYapc');
  await reqParamsStore.initYapcDefaults();
}

</script>

<template>
  <div class="sr-yapc-container">
    <div class="sr-yapc-header">
      <SrCheckBox
          v-model="reqParamsStore.enableYAPC"
          label="YAPC" 
          tooltipText="The experimental YAPC (Yet Another Photon Classifier) photon-classification scheme." 
          tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#yapc" 
          labelFontSize="large"
          @update:modelValue=initYapc          
      />
    </div>
    <div class="sr-yapc-version-header">
      <SrMenu
          v-model="reqParamsStore.YAPCVersion"
          :selected="reqParamsStore.usesYAPCVersion"
          label = "Version"
          aria-label="Select Version"
          :menuOptions="YAPCVersionOptions"
          :getSelectedMenuItem="reqParamsStore.getYAPCVersion"
          :setSelectedMenuItem="reqParamsStore.setYAPCVersion"
          :insensitive="!reqParamsStore.enableYAPC"
      />
    </div>
    <div class="sr-simple-slider-wrapper">
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
      />
    </div>
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
    />
    <SrSwitchedSliderInput
        label="Min Knn"
        v-model="reqParamsStore.YAPCMinKnn"
        :getCheckboxValue="reqParamsStore.getUseYAPCMinKnn"
        :setCheckboxValue="reqParamsStore.setUseYAPCMinKnn"
        :getValue="reqParamsStore.getYAPCMinKnn"
        :setValue="reqParamsStore.setYAPCMinKnn"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.enableYAPC"
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
    />
  </div>
</template>
<style scoped>

.sr-yapc-container {
  padding: 0.75rem;
  border: 1px solid grey;
  border-radius: var(--p-border-radius);
}

.sr-yapc-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin: 0.25rem;
  margin-bottom: 1rem;
}

.sr-yapc-version-header {
  display: inline-flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
}
.sr-simple-slider-wrapper {
  padding: 0.125rem;
}
:deep(.sr-yapc-header .sr-checkbox-label){
    font-size: large;
}
</style>