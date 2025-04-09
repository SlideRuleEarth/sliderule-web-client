<template>
    <div class="sr-slider-input-wrapper">
        <div class="sr-slider-col">
            <SrLabelInfoIconButton v-if="label != ''" :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="props.insensitive"/>
            <div class="sr-slider-input-row">
                <Slider 
                    v-model="innerValue" 
                    :name="sliderName" 
                    :min="sliderMin" 
                    :max="sliderMax" 
                    :step="sliderStepSize" 
                    class="sr-slider" 
                    :disabled="props.insensitive" 
                    :style="{ width: props.sliderWidth }"
                />
                <InputNumber 
                    v-model="innerValue"
                    :inputId="inputId"
                    :disabled="props.insensitive"
                    :min="props.min"
                    :max="props.max"
                    :step="sliderStepSize"
                    :style="{ width: props.inputWidth, maxWidth: props.inputWidth }"
                    :useGrouping="true"
                    :format="true"
                    :locale="'en-US'"
                    :maxFractionDigits="props.decimalPlaces"
                    :minFractionDigits="props.decimalPlaces"
                    class="sr-slider-input-num"
                    size="small"
                />
                <span class="sr-units-label">{{ props.unitsLabel }}</span>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import { watchDebounced } from '@vueuse/core';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const props = defineProps({
    modelValue: Number,
    insensitive: { type: Boolean, default: false },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    sliderMin: { type: Number, default: 0 },
    sliderMax: { type: Number, default: 100 },
    defaultValue: { type: Number, default: 0 },
    label: { type: String, default: 'Label' },
    unitsLabel: { type: String, default: '' },
    id: { type: String, default: 'sr-slider-input-' + Math.random().toString(36).substring(2, 9) },
    decimalPlaces: { type: Number, default: 0 },
    tooltipText: { type: String, default: 'tooltip text' },
    tooltipUrl: { type: String, default: '' },
    inputWidth: { type: [String, Number], default: '6rem' },
    sliderWidth: { type: [String, Number], default: '12rem' }
});

const emit = defineEmits(['update:modelValue']);

const innerValue = ref(props.defaultValue);
const sliderStepSize = ref(Math.pow(10, -props.decimalPlaces));

onMounted(() => {
    sliderStepSize.value = Math.pow(10, -props.decimalPlaces);
    innerValue.value = props.modelValue ?? props.defaultValue;
});

watch(() => props.decimalPlaces, (newDecimalPlaces) => {
    sliderStepSize.value = Math.pow(10, -newDecimalPlaces);
});

watchDebounced(() => props.modelValue, (newVal) => {
    innerValue.value = newVal ?? props.defaultValue;
}, { debounce: 500, maxWait: 1000 });

watchDebounced(innerValue, (newVal) => {
    emit('update:modelValue', newVal);
}, { debounce: 500, maxWait: 1000 });

const inputId = props.label && props.label.trim() !== ''
    ? `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`
    : props.id;

const sliderName = `sr-slider-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;
</script>

<style scoped>
.sr-slider-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
    margin: 0.25rem;
}
.sr-slider-col {
    display: flex;
    flex-direction: column;
    align-items: self-start;
    justify-content: left;
}
.sr-slider-label-icon-row {
    display: flex;
    justify-content: left;
    align-items: center;
}
.sr-slider-input-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.sr-slider {
    width: 12rem; 
    margin-right: 0.5rem;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
}

.sr-slider-input-num {
    width: 100%;
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

</style>