<template>
    <label class="custom-checkbox" :title="props.tooltipText">
      <!-- The native checkbox is hidden but still used to handle "checked" state -->
      <input type="checkbox" v-model="isChecked" />
  
      <!-- Show the digit inside the box at all times -->
      <span class="checkmark">
        {{ digit }}
      </span>
  
      <!-- Label to the right -->
      <span class="checkbox-label">
        {{ label }}
      </span>
    </label>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'

  interface SingleDigitCheckboxProps {
    /** The digit to show inside the checkbox. */
    digit: number;
    /** The label shown to the right of the checkbox. */
    label: string;
    /**
     * v-model for a `number[]`. If `digit` is in the array,
     * the checkbox is considered "checked".
     */
    modelValue: number[];
    tooltipText: string;
  }
  
  const props = defineProps<SingleDigitCheckboxProps>()
  const emit = defineEmits(['update:modelValue','user-checked'])
  
  /**
   * Computed boolean to determine if `digit` is in the array.
   * When toggled, it will add/remove the digit from the array
   * and emit the updated array.
   */
  const isChecked = computed<boolean>({
    get: () => {
      return props.modelValue.includes(props.digit)
    },
    set: (checked: boolean) => {
      // Make a shallow copy of the array to avoid mutating props
      let newValue = [...props.modelValue]
  
      if (checked && !newValue.includes(props.digit)) {
        newValue.push(props.digit)
      } else if (!checked && newValue.includes(props.digit)) {
        newValue = newValue.filter(num => num !== props.digit)
      }
      emit('update:modelValue', newValue)
      emit('user-checked', props.digit); // or no arguments, as you wish
    },
  })
  </script>
  
  <style scoped>
  .custom-checkbox {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none; /* Prevent text selection when clicking */
  }
  
  /* Hide the native checkbox input */
  .custom-checkbox input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    width: 0;
    height: 0;
  }
  
  /* Checkbox's visible box containing the digit */
  .checkmark {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 1.25rem;               
    height: 1.25rem;              
    margin-right: 0.5rem;       
    border: 1px solid var(--p-content-border-color); /* Use your border color */
    border-radius: 0.25rem;     
    background-color: transparent;
    color: white;
    font-family: monospace;
    font-size:x-small;           
    font-weight:lighter;
    transition: background-color 0.2s, color 0.2s;
  }
  
  /* When checked, fill background with primary color and invert digit color */
  input[type="checkbox"]:checked + .checkmark {
    background-color: var(--primary-color, #007bff);
    color: #fff;
  }
  
  .checkbox-label {
    margin-left: 0.125rem;        /* 4px → 0.25rem */
    font-family: monospace;
    font-size:smaller;             /* Increase size for visibility */
    font-weight: normal;
    color: white;
  }
  </style>
  