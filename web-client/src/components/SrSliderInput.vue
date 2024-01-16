<template>
    <div class="slider-input-wrapper">
      <div class="slider-row">
            <label class="label">{{ label }}</label>
            <Slider v-model="innerValue" :min="min" :max="max" class="slider" />
            <InputText v-model="formattedValue" class="input-text" />
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import {useToast} from "primevue/usetoast";

    import { ref, watch, computed,onMounted } from 'vue';
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import { defineProps, defineEmits } from 'vue';

    const toast = useToast();

    const props = defineProps({
    modelValue: {
        type: Number,
        required: true
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
    decimalPlaces: {
        type: Number,
        default: 0 // Default to 0 decimal places
    }
    });

    // Compute the step size based on decimalPlaces
    const stepSize = ref(Math.pow(10, -props.decimalPlaces));

    // Initialize stepSize as a ref with a default value
    onMounted(() => {
        stepSize.value = Math.pow(10, -props.decimalPlaces);
        console.log('The Step Size:', stepSize.value);
    });

    const emit = defineEmits(['update:modelValue']);

    const innerValue = ref(props.modelValue);

    watch(() => props.modelValue, (newValue) => {
        innerValue.value = newValue;
    });

    watch(innerValue, (newValue) => {
        emit('update:modelValue', newValue);
    });

    watch(stepSize, (newValue) => {
        console.log('Updated Step Size:', newValue);
    });

    watch(() => props.decimalPlaces, (newDecimalPlaces) => {
        stepSize.value = Math.pow(10, -newDecimalPlaces);
        console.log('Updated Step Size:', stepSize.value);
    });

    const formattedValue = computed({
        get: () => innerValue.value.toFixed(props.decimalPlaces),
        set: (val) => {
            // Check if the input is a number
            let numericValue = parseFloat(val);
            //console.log('val:', val)
            //console.log('numericValue:', numericValue)
            if (isNaN(numericValue)) {
                console.log('Bad numericValue:',numericValue)
                toast.add({ severity: 'error', summary: 'Error', detail: 'Input must be a number', life: 3000 });
                // Handle non-numeric input - reset to the last valid value
                numericValue = innerValue.value;
            } else {
                //console.log('Good numericValue:',numericValue)
                // Round to the allowed number of decimal places
                numericValue = parseFloat(numericValue.toFixed(props.decimalPlaces));

                // Clamp the value within the min and max range
                numericValue = Math.min(Math.max(numericValue, props.min), props.max);
            }

            // Update the innerValue
            innerValue.value = numericValue;
        }
    });
    
</script>

<style scoped>
.slider-input-wrapper {
    border: 1px solid var(--primary-color);
    border-top: 0.0625rem solid var(transparent);
    border-radius: var(--border-radius);
}

.slider-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}
.label {
    margin-right: 0.5rem;
}
.slider {
    min-width: 5rem; /* Example width, adjust as needed */
    margin-right: 0.5rem;
}

.input-text {
    width: 5em; /* Adjust as needed for 5 digits */
    text-align: right;
    padding: 0.25rem;
}


</style>
  