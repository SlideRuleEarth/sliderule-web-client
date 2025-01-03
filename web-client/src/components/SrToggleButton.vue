<template>
  <div class="sr-toggle-col">
    <div class="sr-toggle-row" v-if="labelOnRight">
      <ToggleSwitch
        :id="toggleSwitchId"
        v-model="localChecked"
        :disabled="insensitive"
        :dt="designTokenForToggleSwitch"
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
          :for="toggleSwitchId"
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
          :for="toggleSwitchId"
          :class="['sr-toggleswitch-label', { 'sr-toggleswitch-label-insensitive': insensitive }]"
          :style="{ fontSize: labelFontSize }"
        >
          {{ label }}
        </label>
      </div>
      <ToggleSwitch
        :id="toggleSwitchId"
        v-model="localChecked"
        :disabled="insensitive"
        :dt="designTokenForToggleSwitch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import ToggleSwitch from 'primevue/toggleswitch';

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
  },
  getValue: {
    type: Function,
    default: () => {}
  },
  setValue: {
    type: Function,
    default: () => {}
  }
});

const emit = defineEmits(['update:modelValue']);

const toggleSwitchId = computed(() => 'sr-toggleswitch-' + props.label);

const localChecked = computed({
  get: () => props.getValue(),
  set: (value) => {
    props.setValue(value);
  }
});

watch(localChecked, (value) => {
  console.log(`SrToggleButton: ${props.label} changed to: ${value}`);
  emit('update:modelValue', value);
});

const designTokenForToggleSwitch = ref({
  width: '2rem',
  height: '1rem',
  handle: {
    size: '0.85rem',
  },
  colorScheme: {
    light: {
      root: {
        checkedBackground: '{blue.500}',
        checkedHoverBackground: '{blue.600}',
      },
      handle: {
        checkedBackground: '{blue.50}',
        checkedHoverBackground: '{blue.100}',
      },
    },
    dark: {
      root: {
        checkedBackground: '{blue.400}',
        checkedHoverBackground: '{blue.300}',
      },
      handle: {
        checkedBackground: '{blue.900}',
        checkedHoverBackground: '{blue.800}',
      },
    },
  },
});
</script>

<style scoped>
.sr-toggle-col {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.125rem;
  font-size: small;
}

.sr-toggle-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 0.125rem;
  font-size: small;
}

.sr-toggleswitch-label {
  white-space: nowrap;
  font-size: small;
}

.sr-toggleswitch-label-insensitive {
  color: #888;
}
</style>
