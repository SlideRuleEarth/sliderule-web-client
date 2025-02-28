<template>
    <div class="sr-checkbox">
      <template v-if="labelOnRight">
        <input 
          :id="'sr-checkbox-' + label" 
          type="checkbox" 
          v-model="localChecked" 
          :disabled="insensitive"
          @change="emitChange"
        />
      </template>
      <template v-if="tooltipText || tooltipUrl">
        <SrLabelInfoIconButton 
          :label="label" 
          :tooltipText="tooltipText" 
          :tooltipUrl="tooltipUrl" 
          :insensitive="insensitive" 
          :labelFontSize="labelFontSize"
        />
      </template>
      <template v-else>
        <label 
          :for="'sr-checkbox-' + label" 
          :class="['sr-checkbox-label', { 'sr-checkbox-label-insensitive': insensitive }]"
          :style="{ fontSize: labelFontSize }"
        >
          {{ label }}
        </label>
      </template>
      <template v-if="!labelOnRight">
        <input 
          :id="'sr-checkbox-' + label" 
          type="checkbox" 
          v-model="localChecked" 
          :disabled="insensitive"
          @change="emitChange"
        />
      </template>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch, onMounted, isRef, WritableComputedRef } from 'vue';
  import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
  
  // Props definition
  const props = withDefaults(
    defineProps<{
      label?: string;
      modelValue: boolean | WritableComputedRef<boolean>;
      insensitive?: boolean;
      tooltipText?: string;
      tooltipUrl?: string;
      labelFontSize?: string;
      labelOnRight?: boolean;
      defaultValue?: boolean;
    }>(),
    {
      label: '',
      modelValue: false,
      insensitive: false,
      tooltipText: '',
      tooltipUrl: '',
      labelFontSize: 'small',
      labelOnRight: false,
      defaultValue: false,
    }
  );
  
  const emit = defineEmits(['update:modelValue']);
  
  // Helper function to get or set ref values
  const getValue = (value: boolean | WritableComputedRef<boolean>) =>
    isRef(value) ? value.value : value;
  
  const setValue = (value: boolean | WritableComputedRef<boolean>, newValue: boolean) => {
    if (isRef(value)) {
      value.value = newValue;
    } else {
      emit('update:modelValue', newValue);
    }
  };
  
  // Local state
  const localChecked = ref(getValue(props.modelValue));
  
  // Sync `modelValue` with `localChecked`
  watch(() => props.modelValue, (newValue) => {
    localChecked.value = getValue(newValue);
  });
  
  // Emit changes to `modelValue` when `localChecked` changes
  watch(localChecked, (newValue) => {
    setValue(props.modelValue, newValue);
  });
  
  // Initialize `localChecked` on mount
  onMounted(() => {
    setValue(props.modelValue, props.defaultValue);
  });
  
  const emitChange = () => {
    //console.log(`SrCheckbox: ${props.label}: ${localChecked.value}`);
  };
  </script>
  
  <style scoped>
  .sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin: 0.25rem;
  }
  
  .sr-checkbox-label {
    white-space: nowrap;
    font-size: small;
  }
  
  .sr-checkbox-label-insensitive {
    white-space: nowrap;
    color: #888; /* grey color */
  }
  </style>
  