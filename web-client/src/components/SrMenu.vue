<template>
  <div class="sr-menu-input-wrapper">
    <div class="sr-menu-column">
      <SrLabelInfoIconButton
        :label="label"
        :labelFontSize="labelFontSize"
        :labelFor="`srSelectMenu-${label}`"
        :tooltipText="tooltipText"
        :tooltipUrl="tooltipUrl"
        :insensitive="insensitive"
      />
      <form
        :class="{
          'sr-select-menu-item': !insensitive,
          'sr-select-menu-item-insensitive': insensitive
        }"
        name="sr-select-item-form"
      >
        <select
          v-model="selectedMenuItem"
          :class="{
            'sr-select-menu-default': !insensitive,
            'sr-select-menu-default-insensitive': insensitive
          }"
          name="sr-select-menu"
          :id="`srSelectMenu-${label}`"
          :aria-label="label"
          :disabled="insensitive"
          :title="tooltipText"
        >
          <option v-for="item in menuOptions" :label="item" :value="item" :key="item">
            {{ item }}
          </option>
        </select>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue'

const props = defineProps({
  label: {
    type: String,
    default: ''
  },
  menuOptions: Array as () => string[],
  insensitive: {
    type: Boolean,
    default: false
  },
  defaultOptionIndex: {
    type: Number,
    default: 0
  },
  getSelectedMenuItem: {
    type: Function,
    required: true
  },
  setSelectedMenuItem: {
    type: Function,
    required: true
  },
  tooltipText: {
    type: String,
    default: 'tooltip text'
  },
  tooltipUrl: {
    type: String,
    default: ''
  },
  justify_center: {
    type: Boolean,
    default: false
  },
  labelFontSize: {
    type: String,
    default: 'small' // default font size if not passed
  }
})
// Define a computed property that references the getter and setter
const selectedMenuItem = computed({
  get() {
    const menuItem = props.getSelectedMenuItem()
    //console.log('SrMenu:', props.label, 'get:', menuItem);
    return menuItem // calling the getter function
  },
  set(value) {
    //console.log('SrMenu:', props.label, 'set:', value)
    props.setSelectedMenuItem(value) // calling the setter function
  }
})

const emit = defineEmits(['update:modelValue'])

watch(selectedMenuItem, (newValue) => {
  //console.log('Menu:', props.label, 'selected:', newValue);
  //console.log('Menu:', props.label, 'readback:', props.getSelectedMenuItem());
  emit('update:modelValue', newValue)
})

onMounted(() => {
  //console.log('Mounted Menu:', props.label , 'selected:', selectedMenuItem.value, 'default:', props.defaultOptionIndex);
  // const primaryColor = $dt('primary.color');
  // const borderRadius = $dt('border.radius');
  // const fontFamily = $dt('font.family');
  //console.log('Menu:', props.label, 'primaryColor:', primaryColor, 'borderRadius:', borderRadius, 'fontFamily:', fontFamily);
})
</script>

<style scoped>
.sr-menu-input-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.sr-menu-column {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.sr-select-menu-item,
.sr-select-menu-item-insensitive {
  width: 100%;
  margin-top: 0.5rem;
}

.sr-select-menu-default,
.sr-select-menu-default-insensitive {
  width: 100%;
  padding: 0.5rem 0.5rem 0.5rem 0.5rem; /* Top Right Bottom Left */
  color: white;
  background-color: #2c2c2c;
  border: 2px solid #3a3a3a;
  border-radius: 0.5rem;
  font-family: var(--p-font-family);
  font-size: small;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease;
}

.sr-select-menu-default-insensitive {
  color: #888;
  background-color: #1e2b38;
  cursor: not-allowed;
}

.sr-select-menu-default:focus {
  outline: none;
}
</style>
