<template>
  <div class="sr-multi-select-check-container">
    <!-- Flex container for aligning select all and options list -->
    <div class="options-flex-container">
      <div class="multi-select-option-container select-all-container">
        <input type="checkbox" id="selectAll" v-model="selectAllChecked" >
        <label for="selectAll">All</label>
      </div>
      
      <!-- Options list container -->
      <div class="options-list-container">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref,computed } from 'vue';

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

const selectAllChecked = computed({
  get: () => menuOptions.value.every(option => option.selected),
  set: (value) => {
    menuOptions.value.forEach(option => {
      option.selected = value;
      if (!value) option.additionalParameter = false; // Uncheck additional param if deselecting
    });
  },
});

const toggleSelection = (option: SrMenuMultiCheckInputOption, event: MouseEvent) => {
  if (!(event.target instanceof HTMLInputElement)) {
    option.selected = !option.selected;
    if (!option.selected) {
      option.additionalParameter = false; // Uncheck the checkbox when deselecting the item
    }
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

/* New flex container for aligning select all and options */
.options-flex-container {
  display: flex;
  align-items: center; /* Align items at the start of the container */
}


.multi-select-option-container {
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
}

.sr-multi-select-checkbox {
  margin-left: 1rem;
}

/* Style the selected row */
.selected {
  background-color: var(--p-primary-300);
}

/* Container for the list of options */
.options-list-container {
  display: flex;
  flex-direction: column;
  min-width: 8rem;
  /* Add more styles here to manage spacing and alignment if necessary */
}

</style>
