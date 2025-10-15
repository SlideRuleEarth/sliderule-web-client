<template>
  <div class="sr-checkbox">
    <Checkbox
      v-if="!labelOnLeft" 
      class="sr-checkbox-input-label-left"
      :inputId="'sr-checkbox-' + label" 
      v-model="localChecked" 
      :binary="true" 
      :disabled="insensitive"
      @change="emitChange"
      size="small"
    />

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
    <Checkbox
      v-if="labelOnLeft" 
      class="sr-checkbox-input-label-right"
      :inputId="'sr-checkbox-' + label" 
      v-model="localChecked" 
      :binary="true" 
      :disabled="insensitive"
      @change="emitChange"
      size="small"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, isRef } from 'vue';
import type { WritableComputedRef } from 'vue';
import Checkbox from 'primevue/checkbox';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const props = withDefaults(
  defineProps<{
    label?: string;
    modelValue: boolean | WritableComputedRef<boolean>;
    insensitive?: boolean;
    tooltipText?: string;
    tooltipUrl?: string;
    labelFontSize?: string;
    defaultValue?: boolean;
    labelOnLeft?: boolean;
  }>(),
  {
    label: '',
    modelValue: false,
    insensitive: false,
    tooltipText: '',
    tooltipUrl: '',
    labelFontSize: 'small',
    defaultValue: undefined,
    labelOnLeft: false,
  }
);

const emit = defineEmits(['update:modelValue']);

const getValue = (value: boolean | WritableComputedRef<boolean>) =>
  isRef(value) ? value.value : value;

const setValue = (value: boolean | WritableComputedRef<boolean>, newValue: boolean) => {
  if (isRef(value)) {
    value.value = newValue;
  } else {
    emit('update:modelValue', newValue);
  }
};

const localChecked = ref(getValue(props.modelValue));

watch(() => props.modelValue, (newValue) => {
  localChecked.value = getValue(newValue);
});

watch(localChecked, (newValue) => {
  setValue(props.modelValue, newValue);
});

onMounted(() => {
  // Only override modelValue with defaultValue if defaultValue was explicitly provided
  if (props.defaultValue !== undefined) {
    setValue(props.modelValue, props.defaultValue);
  }
});

const emitChange = () => {
  // Optional logging
};
</script>

  
<style scoped>
  .sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .sr-checkbox-input-label-right {
    margin-left: 0.5rem;
  }

  .sr-checkbox-input-label-left {
    margin-right: 0.5rem;
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
  