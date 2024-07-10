<template>
    <div class="sr-toggle-col">
      <div class="sr-toggle-row" v-if="labelOnRight">
        <ToggleSwitch
          :id="'sr-toggleswitch-' + label"
          v-model="localChecked"
          :disabled="insensitive"
          @change="handleChanged"
        />
        <div v-if="tooltipText || tooltipUrl">
          <SrLabelInfoIconButton
            :label="label"
            :tooltipText="tooltipText"
            :tooltipUrl="tooltipUrl"
            :insensitive="insensitive"
            :labelFontSize="labelFontSize"
          />
        </div>
        <div v-else>
          <label
            :for="'sr-toggleswitch-' + label"
            :class="['sr-toggleswitch-label', { 'sr-toggleswitch-label-insensitive': insensitive }]"
            :style="{ fontSize: labelFontSize }"
          >
            {{ label }}
          </label>
        </div>
      </div>
      <div class="sr-toggle-row" v-else>
        <div v-if="tooltipText || tooltipUrl">
          <SrLabelInfoIconButton
            :label="label"
            :tooltipText="tooltipText"
            :tooltipUrl="tooltipUrl"
            :insensitive="insensitive"
            :labelFontSize="labelFontSize"
          />
        </div>
        <div v-else>
          <label
            :for="'sr-toggleswitch-' + label"
            :class="['sr-toggleswitch-label', { 'sr-toggleswitch-label-insensitive': insensitive }]"
            :style="{ fontSize: labelFontSize }"
          >
            {{ label }}
          </label>
        </div>
        <ToggleSwitch
          :id="'sr-toggleswitch-' + label"
          v-model="localChecked"
          :disabled="insensitive"
          @change="handleChanged"
        />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
  import ToggleSwitch from 'primevue/toggleswitch';
  import { ref, computed } from 'vue';
  
  const props = defineProps({
    label: {
      type: String,
      default: ''
    },
    modelValue: {
      type: Boolean,
      default: false
    },
    insensitive: {
      type: Boolean,
      default: false
    },
    tooltipText: {
      type: String,
      default: ''
    },
    tooltipUrl: {
      type: String,
      default: ''
    },
    labelFontSize: {
      type: String,
      default: 'small'
    },
    labelOnRight: {
      type: Boolean,
      default: false
    }
  });
  
  const emit = defineEmits(['update:modelValue']);
  
  const localChecked = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  });
  
  const handleChanged = () => {
    console.log(`SrToggleButton: ${props.label} from: ${localChecked.value}`);
  };
  </script>
  
  <style scoped>
  .sr-toggle-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin: 0.25rem;
    padding: 0.125rem;
    font-size: small;
  }
  .sr-toggle-row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin: 0.25rem;
    padding: 0.125rem;
    font-size: small;
  }
  .sr-toggleswitch {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin: 0.25rem;
  }
  .sr-toggleswitch-label {
    white-space: nowrap;
    font-size: small;
  }
  .sr-toggleswitch-label-insensitive {
    white-space: nowrap;
    color: #888; /* grey color */
  }
  </style>
  