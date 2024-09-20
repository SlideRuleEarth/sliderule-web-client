<template>
  <label
    class="radio-button-label"
    :title="tooltipText"
    :class="{ 'disabled': isDisabled }" 
  >
    <input
      type="radio"
      :value="value"
      :checked="isChecked"
      @change="handleChange"
      class="radio-input"
      :name="tooltipText"
      :aria-label="ariaLabel"
      :disabled="isDisabled" 
    />
    <!-- If icon is present, render it -->
    <span v-if="icon" v-html="icon" class="icon-svg" name="icon-svg"></span>
    <!-- If icon is not present, display value instead -->
    <span v-else class="icon-svg">{{ value }}</span>
  </label>
</template>
 
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    name: string;
    class: string;
    value?: string;
    modelValue?: string;
    icon?: string;
    ariaLabel?: string;
    tooltipText?: string;
    disabled?: boolean; 
  }>(),
  {
    name: '',
    class: '',
    value: undefined,
    modelValue: '',
    icon: '',
    ariaLabel: '',
    tooltipText: '',
    disabled: false,
  }
);

const emit = defineEmits(['update:modelValue']);

const isChecked = computed(() => {
  return props.modelValue === props.value;
});

const isDisabled = computed(() => props.disabled); 

const handleChange = (event: Event) => {
  if (!isDisabled.value) { 
    try {
      const target = event.target as HTMLInputElement;
      if (target) {
        emit('update:modelValue', target.value);
      }
    } catch (error) {
      console.log(error);
    }
  }
};
</script>

<style scoped>
.radio-button-label {
  margin: 1px;
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: column; /* Stack children vertically */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  border-radius: 5px; /* Rounded corners */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); /* Slight shadow */
  transition: background-color 0.3s ease, transform 0.1s ease, box-shadow 0.1s ease;
  cursor: pointer; /* Change cursor to pointer on hover */
}

.radio-button-label:hover {
  background-color: rgba(60, 60, 60, 1); /* Change color on hover */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Reduce shadow to enhance the pressed look */
}

.radio-button-label:active {
  transform: translateY(4px); /* Further downward movement when clicked */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); /* Even smaller shadow */
  background-color: #a9a9a9; /* Darker grey to simulate pressed state */
  transform: translateY(2px); /* Slight downward movement to simulate press */
}

.radio-button-label.disabled {
  cursor: not-allowed; /* Indicate that the button is disabled */
  opacity: 0.5; /* Make the button look disabled */
}

input[type='radio'] {
  margin: 0;
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.icon-svg {
  margin: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6em;
  height: 1.6em;
}
</style>

