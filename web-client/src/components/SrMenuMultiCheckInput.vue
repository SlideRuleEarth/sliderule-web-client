<template>
  <div class="multi-select-container">
    <div v-for="option in menuOptions" :key="option.value" 
         @click="toggleSelection(option, $event)"
         :class="{ 'selected': option.selected }">
      <label>{{ option.label }}</label>

      <input 
        type="checkbox" 
        v-model="option.additionalParameter" 
        :disabled="!option.selected"
        @change="handleAdditionalParamChange(option)" 
      /> 
      <label>{{ additionalParamLabel }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

export interface SrMenuMultiCheckInputOption {
  label: string;
  value: string; // Or other relevant type
  selected: boolean;
  additionalParameter: boolean;
}

const props = defineProps<{
  menuOptions: SrMenuMultiCheckInputOption[];
  additionalParamLabel: string;
}>()

const menuOptions = ref<SrMenuMultiCheckInputOption[]>(props.menuOptions);

const toggleSelection = (option: SrMenuMultiCheckInputOption, event: MouseEvent) => {
  if (!(event.target instanceof HTMLInputElement)) {
    option.selected = !option.selected;
  }
};

function handleAdditionalParamChange(option: SrMenuMultiCheckInputOption) {
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
