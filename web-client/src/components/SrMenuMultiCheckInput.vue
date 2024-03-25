<template>
  <div class="multi-select-container">
    <div v-for="option in options" :key="option.value" 
         @click="toggleSelection(option)"
         :class="{ 'selected': option.selected }">
      <label>{{ option.label }}</label>

      <input 
        type="checkbox" 
        v-model="option.additionalParameter" 
        :disabled="!option.selected"
        @change="handleAdditionalParamChange(option)" 
      /> 
      <label>Additional Parameter</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Option {
  label: string;
  value: string; // Or other relevant type
  selected: boolean;
  additionalParameter: boolean;
}

const options = ref<Option[]>([
  { label: 'Option 1', value: 'opt1', selected: false, additionalParameter: false },
  { label: 'Option 2', value: 'opt2', selected: false, additionalParameter: false },
  { label: 'Option 3', value: 'opt3', selected: false, additionalParameter: false },
]);

const toggleSelection = (option: Option) => {
  option.selected = !option.selected;
};

function handleAdditionalParamChange(option: Option) {
  // You can add any extra logic for managing the additional parameter here 
  // Example: Send updated option data to an API 
}
</script>

<style scoped>
.multi-select-container {
  cursor: pointer;
}

/* Style the selected row */
.selected {
  background-color: #e0e0e0;
}
</style>
