<template>
    <div class="sr-slider-input-wrapper">
        <div class="sr-slider-col">
            <label :for="inputId" class="sr-visually-hidden">{{ label }}</label>
            <SrLabelInfoIconButton v-if="label != ''" :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="props.insensitive"/>
            <div class="sr-slider-input-row">
                <Slider 
                    v-model="innerValue" 
                    :name="sliderName" 
                    :min="effectiveSliderMin" 
                    :max="effectiveSliderMax" 
                    :step="sliderStepSize" 
                    class="sr-slider" 
                    :disabled="props.insensitive" 
                    :style="{ width: props.sliderWidth }"
                    @blur="handleBlur('slider')"
                    @change="handleChange('slider')"
                />
                <InputNumber 
                    v-model="innerValue"
                    :inputId="inputId"
                    :disabled="props.insensitive"
                    :min="props.min"
                    :max="props.max"
                    :step="sliderStepSize"
                    :style="{ width: props.inputWidth, maxWidth: props.maxWidth }"
                    :useGrouping="true"
                    :format="true"
                    :locale="'en-US'"
                    :maxFractionDigits="props.decimalPlaces"
                    :minFractionDigits="props.decimalPlaces"
                    class="sr-slider-input-num"
                    size="small"
                    @blur="handleBlur('input')"
                    @change="handleChange('input')"
                />
                <span class="sr-units-label">{{ props.unitsLabel }}</span>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import { watchDebounced } from '@vueuse/core';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const props = defineProps({
    modelValue: Number,
    insensitive: { type: Boolean, default: false },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    sliderMin: { type: Number },
    sliderMax: { type: Number },
    defaultValue: { type: Number, default: 0 },
    label: { type: String, default: 'Label' },
    unitsLabel: { type: String, default: '' },
    id: { type: String, default: 'sr-slider-input-' + Math.random().toString(36).substring(2, 9) },
    decimalPlaces: { type: Number, default: 0 },
    tooltipText: { type: String, default: 'tooltip text' },
    tooltipUrl: { type: String, default: '' },
    inputWidth: { type: [String, Number], default: '4rem' },
    maxWidth: { type: [String, Number], default: '7rem' },
    sliderWidth: { type: [String, Number], default: '12rem' }
});

const emit = defineEmits(['update:modelValue', 'blur', 'change']);
const effectiveSliderMin = computed(() => props.sliderMin ?? props.min);
const effectiveSliderMax = computed(() => props.sliderMax ?? props.max);
const innerValue = ref(props.modelValue ?? props.defaultValue);
const sliderStepSize = computed(() => Math.pow(10, -props.decimalPlaces));
const normalizeLabel = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-');

const inputId = props.label.trim() ? `sr-slider-input-${normalizeLabel(props.label)}` : props.id;
const sliderName = `sr-slider-${normalizeLabel(props.label)}`;

const handleBlur = (source: 'slider' | 'input') => (event: FocusEvent) => {
  emit('blur', { source, event });
};

const handleChange = (source: 'slider' | 'input') => (event: Event) => {
  emit('change', { source, value: innerValue.value });
};

onMounted(() => {
    innerValue.value = props.defaultValue;
})
watch(() => props.modelValue, (newVal) => {
  const sanitized = typeof newVal === 'number' && !isNaN(newVal) ? newVal : props.defaultValue;
  if (sanitized !== innerValue.value) {
    innerValue.value = sanitized;
  }
});


watchDebounced(innerValue, (newVal) => {
    emit('update:modelValue', newVal);
}, { debounce: 500, maxWait: 1000 });

</script>

<style scoped>
.sr-slider-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
}

.sr-slider-input-row {
    display: flex;
    justify-content:flex-start;
    align-items: center;
}

.sr-slider {
    width: 12rem; 
    margin-right: 0.5rem;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
}

.sr-slider-input-num {
    width: auto;
    text-align: right;
    padding: 0.125rem;
    font-size:x-small;
    background: transparent;
    border-color: transparent;
}
:deep(.p-inputtext-sm){
    width: 100%;
    font-size: small;
}

.sr-units-label {
    font-size: 0.8rem; /* Adjust as needed */
    margin-left: 0.25rem; /* Adjust spacing if necessary */
}

.sr-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

</style>