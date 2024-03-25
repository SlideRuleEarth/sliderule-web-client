<template>
  <div class="sr-multi-select-check-container">
    <div v-for="option in menuOptions" :key="option.value" 
        @click="toggleSelection(option, $event)"
        :class="{ 'selected': option.selected }">
      <div class="multi-select-option-container">

        <label>{{ option.label }}</label>
        <div>
          <input 
            type="checkbox" 
            v-model="option.additionalParameter" 
            :disabled="!option.selected"
            class="sr-multi-select-checkbox"
            @change="handleAdditionalParamChange(option)" 
          /> 
          <label>{{ additionalParamLabel }}</label>
        </div>
      </div>
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
.sr-multi-select-check-container {
  cursor: pointer;
}

.multi-select-option-container {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Align items at both ends of the row */

}
.sr-multi-select-checkbox {
  margin-left: 1rem;
}
/* Style the selected row */
.selected {
  background-color:var(--primary-300);
}
</style>
