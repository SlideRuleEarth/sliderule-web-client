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
          label="YAPC:"
          :min="1"
          :max="100" 
          :decimalPlaces="0"
      />
    </div>
    <SrMenuInput
        v-model="reqParamsStore.YAPCVersion"
        :selected="reqParamsStore.usesYAPCVersion"
        label = "Version:"
        aria-label="Select Version"
        :menuOptions="reqParamsStore.YAPCVersionOptions"
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSliderInput
        v-model="reqParamsStore.YAPCScore"
        label="Score:"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCKnn"
        :selected="reqParamsStore.usesYAPCKnn"
        checkBoxLabel="Knn:"
        :min="1"
        :max="100" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowHeight"
        :selected="reqParamsStore.usesYAPCWindowHeight"
        checkBoxLabel="Window Height:"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"  
        :insensitive="!reqParamsStore.YAPC"
    />
    <SrSwitchedSliderInput
        v-model="reqParamsStore.YAPCWindowWidth"
        :selected="reqParamsStore.usesYAPCWindowWidth"
        checkBoxLabel="Window Width:"
        :min="1"
        :max="1000" 
        :decimalPlaces="0"
        :insensitive="!reqParamsStore.YAPC"
    />
  </div>
</template>
<style scoped>

.sr-yapc-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
}
.sr-yapc-container {
  margin: 1rem;
  padding: 1rem;
  border: 1px solid grey;
  border-radius: var(--border-radius);
}

</style>