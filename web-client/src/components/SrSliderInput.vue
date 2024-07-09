<template>
    <div class="sr-slider-input-wrapper">
        <div class="sr-slider-col">
            <SrLabelInfoIconButton v-if="label != ''" :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="props.insensitive"/>
            <div class="sr-slider-input-row">
                <Slider v-model="innerValue" :name="sliderName" :min="min" :max="max" class="sr-slider" :disabled="props.insensitive" />
                <InputText v-model="formattedValue" class="sr-slider-input-text" :inputId="inputId" :disabled="props.insensitive"/>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import {useToast} from "primevue/usetoast";
    import { ref, watch, computed, onMounted,  } from 'vue';
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import { watchDebounced } from '@vueuse/core'
    import { useDebounceFn } from '@vueuse/core';
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
        label: {
            type: String,
            default: 'Label'
        },
        id: {
            type: String,
            default: 'sr-slider-input-' + Math.random().toString(36).substring(2, 9)
        },
        decimalPlaces: {
            type: Number,
            default: 0 // Default to 0 decimal places
        },
        tooltipText: {
            type: String,
            default: 'tooltip text'
        },
        tooltipUrl: {
            type: String,
            default: ''
        }
    });
    const modelValueComputed = computed(() => props.modelValue);

    // Compute the step size based on decimalPlaces
    const sliderStepSize = ref(Math.pow(10, -props.decimalPlaces));

    // Initialize sliderStepSize as a ref with a default value
    onMounted(() => {
        //console.log(`label:${props.label} tooltip:${props.tooltipText} insensitive: ${props.insensitive}`);
        sliderStepSize.value = Math.pow(10, -props.decimalPlaces);

        //console.log('The Slider Step Size:', sliderStepSize.value);
    });

    const emit = defineEmits(['update:modelValue']);

    const innerValue = ref(props.defaultValue);

    //const modelValueChanged = (newValue, oldValue) => {
    const modelValueChanged = (newValue:any) => {
        //console.log(`Model value changed from ${oldValue} to ${newValue}`);
        innerValue.value = newValue;
    };

    watchDebounced(modelValueComputed, 
        modelValueChanged,
        { debounce: 500, maxWait: 1000 },
    );

    //const onInnerValueChange = (newValue, oldValue) => {
    const onInnerValueChange = (newValue:any) => {
        //console.log(`Inner value changed from ${oldValue} to ${newValue}`);
        emit('update:modelValue', newValue );
    };
    
    watchDebounced(innerValue, 
        onInnerValueChange,
        { debounce: 500, maxWait: 1000 },
    );

    watch(sliderStepSize, (newValue) => {
        console.log('Updated Slider Step Size:', newValue);
    });

    watch(() => props.decimalPlaces, (newDecimalPlaces) => {
        sliderStepSize.value = Math.pow(10, -newDecimalPlaces);
        //console.log('Updated Slider Step Size:', sliderStepSize.value);
    });

    const updateInnerValue = useDebounceFn((newValue) => {
        innerValue.value = newValue;
    }, 500, {maxWait: 1000}); // Adjust the debounce time (500ms) as needed

    const formattedValue = computed({
        get: () => 
        {
            if (props.insensitive) {
                return '';
            } else {
                // Otherwise, return the formatted number
                //return innerValue.value.toFixed(props.decimalPlaces);
                return innerValue.value.toFixed(props.decimalPlaces).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }
        },
        set: (val) => {
            // Check if the input is a number
            let numericValue = parseFloat(val);
            //console.log('val:', val)
            //console.log('numericValue:', numericValue)
            if (isNaN(numericValue)) {
                console.error('Bad numericValue:',numericValue)
                toast.add({ severity: 'error', summary: 'Error', detail: 'Input must be a number',  life: srToastStore.getLife()});
                // Handle non-numeric input - reset to the last valid value
                numericValue = innerValue.value;
            } else {
                if(numericValue > props.max) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Input must be less than or equal to ' + props.max,  life: srToastStore.getLife()});
                    numericValue = innerValue.value;
                } else if (numericValue < props.min) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Input must be greater than or equal to ' + props.min,  life: srToastStore.getLife()});
                    numericValue = innerValue.value;
                }
                //console.log('Good numericValue:',numericValue)
                // Round to the allowed number of decimal places
                numericValue = parseFloat(numericValue.toFixed(props.decimalPlaces));

                // Clamp the value within the min and max range
                numericValue = Math.min(Math.max(numericValue, props.min), props.max);
            }

            // Use the debounced method to update innerValue
            updateInnerValue(numericValue);
        }
    });

    // const openTooltipUrl = () => {
    //     //console.log('openTooltipUrl:', props.tooltipUrl);
    //     if (props.tooltipUrl) {
    //         window.open(props.tooltipUrl, '_blank')?.focus();
    //     } else {
    //         console.warn('No tooltip URL provided');
    //     }
    // };
    // Method to generate the ID for the Slider element using the label and prefix if possible
    const inputId = props.label && props.label.trim() !== '' ? 
        `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}` : props.id;
    const sliderName = `sr-slider-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;
</script>

<style scoped>
.sr-slider-input-wrapper {
    border: 1px solid transparent;
    border-radius: var(--border-radius);
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

.sr-slider-input-text {
    width: 6em; /* Adjust as needed for 6 digits */
    text-align: right;
    padding: 0.25rem;
    font-size: small;
    background: transparent;
    border-color: transparent;
}

/* :deep(.p-slider .p-slider-handle) {
    width: 12px; 
    height: 12px;
}  */

/* :deep(.p-slider.p-slider-horizontal) {
    height: 0.2rem;
} */

/* :deep(.p-slider.p-slider-horizontal .p-slider-handle) {
    margin-top: -0.25rem;
    margin-left: -0.25rem;
} */

</style>