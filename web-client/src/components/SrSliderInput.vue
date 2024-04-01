<template>
    <div class="sr-slider-input-wrapper">
        <div class="sr-slider-col">
            <div class="sr-slider-label-icon-row">
                <label :class="{ 'sr-slider-label': !insensitive, 'sr-slider-label-insensitive': insensitive }" :for="inputId" :title="tooltipText">{{ label }} </label>
                <!-- Info Icon with Tooltip -->
                <Button v-if="label != ''" icon="pi pi-info-circle" class="p-button-rounded p-button-text p-button-plain sr-info-button " :title="tooltipUrl" @click="openTooltipUrl"></Button>
            </div>
            <div class="sr-slider-input-row">
                <Slider v-model="innerValue" :name="sliderName" :min="min" :max="max" class="sr-slider" :disabled="insensitive" />
                <InputText v-model="formattedValue" class="sr-slider-input-text" :inputId="inputId" :disabled="insensitive"/>
            </div>
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import {useToast} from "primevue/usetoast";
    import Button from 'primevue/button';
    import { ref, watch, computed, onMounted,  } from 'vue';
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import { watchDebounced } from '@vueuse/core'
    import { useDebounceFn } from '@vueuse/core';
    import { useSrToastStore } from "@/stores/srToastStore.js";
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
            default: 'Some tooltip text here'
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
        sliderStepSize.value = Math.pow(10, -props.decimalPlaces);
        //console.log('The Slider Step Size:', sliderStepSize.value);
    });

    const emit = defineEmits(['update:modelValue']);

    const innerValue = ref(props.modelValue);

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
        console.log('Updated Slider Step Size:', sliderStepSize.value);
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
                return innerValue.value.toFixed(props.decimalPlaces);
            }
        },
        set: (val) => {
            // Check if the input is a number
            let numericValue = parseFloat(val);
            //console.log('val:', val)
            //console.log('numericValue:', numericValue)
            if (isNaN(numericValue)) {
                console.log('Bad numericValue:',numericValue)
                toast.add({ severity: 'error', summary: 'Error', detail: 'Input must be a number',  life: srToastStore.getLife()});
                // Handle non-numeric input - reset to the last valid value
                numericValue = innerValue.value;
            } else {
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

    // Add this method in your <script setup> section
    const openTooltipUrl = () => {
        console.log('openTooltipUrl:', props.tooltipUrl);
        if (props.tooltipUrl) {
            window.open(props.tooltipUrl, '_blank').focus();
        } else {
            console.warn('No tooltip URL provided');
        }
    };
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

.sr-slider-label {
    white-space: nowrap;
    font-size: small;
}
.sr-slider-label-insensitive {
    white-space: nowrap;
    color: #888; /*  grey color */
    font-size: small;
}

.sr-slider {
    width: 12rem; 
    margin-right: 0.5rem;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
}

.sr-slider-input-text {
    width: 5em; /* Adjust as needed for 5 digits */
    text-align: right;
    padding: 0.25rem;
    font-size: small;
    background: transparent;
    border-color: transparent;
}

:deep(.p-slider .p-slider-handle) {
    width: 0.52rem; 
    height: 0.52rem;
    border-radius: 50%; 
} 

:deep(.p-slider.p-slider-horizontal) {
    height: 0.2rem;
}

:deep(.p-slider.p-slider-horizontal .p-slider-handle) {
    margin-top: -0.25rem;
    margin-left: -0.25rem;
}

:deep(.p-button.p-button-icon-only.p-button-rounded.p-button-text.p-button-plain.sr-info-button) {
    margin-left: 0.25rem;
    padding: 0rem;
    height: 1rem;
    width: 1rem;
    color: var(--primary-300);
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    padding-left: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--primary-300);
}
</style>