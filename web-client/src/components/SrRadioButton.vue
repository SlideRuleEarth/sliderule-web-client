<template>
  <label class="radio-button-label" :title="computedTooltipText" :class="{ disabled: isDisabled }">
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
import { computed } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrRadioButton')

const props = withDefaults(
  defineProps<{
    name: string
    class: string
    value?: string
    modelValue?: string
    icon?: string
    ariaLabel?: string
    tooltipText?: string
    disabled?: boolean
  }>(),
  {
    name: '',
    class: '',
    value: undefined,
    modelValue: '',
    icon: '',
    ariaLabel: '',
    tooltipText: '',
    disabled: false
  }
)

const emit = defineEmits(['update:modelValue'])

const isChecked = computed(() => {
  return props.modelValue === props.value
})

const isDisabled = computed(() => props.disabled)

// Dynamically set the tooltip text
const computedTooltipText = computed(() => {
  return isDisabled.value
    ? 'Choose: General -> Polygon Source -> Draw on Map to enable'
    : props.tooltipText || ''
})

const handleChange = (event: Event) => {
  if (!isDisabled.value) {
    try {
      const target = event.target as HTMLInputElement
      if (target) {
        emit('update:modelValue', target.value)
      }
    } catch (error) {
      logger.error('handleChange error', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
</script>

<style scoped>
.radio-button-label {
  margin: 1px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-border-radius);
  background: transparent;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  cursor: pointer;
}

.radio-button-label:hover {
  background: color-mix(in srgb, var(--p-primary-color) 30%, transparent);
}

.radio-button-label:active {
  background: color-mix(in srgb, var(--p-primary-color) 50%, transparent);
  transform: translateY(1px);
}

.radio-button-label.disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
