<template>
  <div class="multi-select-container">
    <div v-for="option in options" :key="option.value">
      <input
        type="checkbox"
        :value="option.value"
        v-model="selectedValues"
      />
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
import { ref, watch } from 'vue';

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

const selectedValues = ref<string[]>([]); 

function handleAdditionalParamChange(option: Option) {
  // You can add any extra logic for managing the additional parameter here 
  // Example: Send updated option data to an API 
}

// Watch for changes in selectedValues and update the options accordingly
watch(selectedValues, (newSelectedValues: string[]) => {
  options.value.forEach(option => {
    option.selected = newSelectedValues.includes(option.value);
  });
});
</script>
