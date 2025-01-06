<template>
    <div class="sr-slider-input-wrapper">
        <div class="sr-slider-col">
            <SrLabelInfoIconButton
                v-if="label !== ''"
                :label="label"
                :tooltipText="tooltipText"
                :tooltipUrl="tooltipUrl"
                :insensitive="props.insensitive"
            />
            <div class="sr-slider-input-row">
                <Slider
                    v-model="modelValueComputed"
                    :name="sliderName"
                    :min="min"
                    :max="max"
                    :step="sliderStepSize"
                    class="sr-slider"
                    :disabled="props.insensitive"
                />
                <!-- Pass the inputWidth as an inline style -->
                <InputText
                    v-model="formattedValue"
                    class="sr-slider-input-text"
                    :inputId="inputId"
                    :disabled="props.insensitive"
                    :style="{ width: props.inputWidth }" 
                />
                <span class="sr-units-label">{{ props.unitsLabel }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import {useToast} from "primevue/usetoast";
    import { ref, computed, onMounted } from 'vue';
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import { useSrToastStore } from "@/stores/srToastStore.js";
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    const srToastStore = useSrToastStore();
    const toast = useToast();

    const props = defineProps({
        modelValue: {
            type: Number,
            required: true
        },
        insensitive: {
            type: Boolean,
            default: false
        },
        min: {
            type: Number,
            default: 0
        },
        max: {
            type: Number,
            default: 100
        },
        defaultValue: {
            type: Number,
            default: 0
        },
        getValue: {
            type: Function,
            required: true
        },
        setValue: {
            type: Function,
            required: true
        },
        label: {
            type: String,
            default: 'Label'
        },
        unitsLabel: {
            type: String,
            default: ''
        },
        id: {
            type: String,
            default: 'sr-slider-input-' + Math.random().toString(36).substring(2, 9)
        },
        decimalPlaces: {
            type: Number,
            default: 0
        },
        tooltipText: {
            type: String,
            default: 'tooltip text'
        },
        tooltipUrl: {
            type: String,
            default: ''
        },
        inputWidth: {
            type: [String, Number],
            default: '2em'
        }
    });

    const emit = defineEmits(['update:modelValue']);

    // The rest is the same logic from your original file...
    const modelValueComputed = computed({
        get() {
            const item = props.getValue();
            return item;
        },
        set(value) {
            props.setValue(value);
        }
    });

    const sliderStepSize = ref(Math.pow(10, -props.decimalPlaces));

    onMounted(() => {
        sliderStepSize.value = Math.pow(10, -props.decimalPlaces);
        modelValueComputed.value = props.modelValue;
    });

    const formattedValue = computed({
        get: () => {
            if (props.insensitive) {
                return '';
            } else {
                return new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: props.decimalPlaces,
                    maximumFractionDigits: props.decimalPlaces
                }).format(modelValueComputed.value);
            }
        },
        set: (val) => {
            let numericValue = parseFloat(val);
            if (isNaN(numericValue)) {
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Input must be a number',
                    life: srToastStore.getLife()
                });
                modelValueComputed.value = numericValue;
            } else {
                if(numericValue > props.max) {
                    toast.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Input must be less than or equal to ' + props.max,
                        life: srToastStore.getLife()
                    });
                    modelValueComputed.value = props.max;
                } else if (numericValue < props.min) {
                    toast.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Input must be greater than or equal to ' + props.min,
                        life: srToastStore.getLife()
                    });
                    modelValueComputed.value = props.min;
                }
                modelValueComputed.value = parseFloat(numericValue.toFixed(props.decimalPlaces));
                modelValueComputed.value = Math.min(Math.max(numericValue, props.min), props.max);

            }
        }
    });

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
    width: 5rem; 
    margin-right: 0.5rem;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
}

.sr-slider-input-text {
    text-align: right;
    padding: 0.25rem;
    font-size: small;
    background: transparent;
    border-color: transparent;
}

.sr-units-label {
    font-size: 0.8rem;
    margin-left: 0.25rem;
}
</style>
