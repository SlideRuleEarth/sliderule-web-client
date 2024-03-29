<script setup lang="ts">
import SrSliderInput from './SrSliderInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckBox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();
</script>

<template>
  <div class="sr-yapc-container">
    <div class="sr-yapc-header">
      <SrCheckBox
          v-model="reqParamsStore.YAPC"
          label="YAPC"
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
        :selected="reqParamsStore.usesYAPCKnn"
        label="Knn"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowHeight"
        :selected="reqParamsStore.usesYAPCWindowHeight"
        label="Window Height"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"  
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowWidth"
        :selected="reqParamsStore.usesYAPCWindowWidth"
        label="Window Width"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
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

</style>