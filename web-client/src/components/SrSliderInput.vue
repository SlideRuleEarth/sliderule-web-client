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
    const modelValueChanged = (newValue) => {
        //console.log(`Model value changed from ${oldValue} to ${newValue}`);
        innerValue.value = newValue;
    };
    watchDebounced(modelValueComputed, 
        modelValueChanged,
        { debounce: 500, maxWait: 1000 },
    );

    //const onInnerValueChange = (newValue, oldValue) => {
    const onInnerValueChange = (newValue) => {
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
        get: () => innerValue.value.toFixed(props.decimalPlaces),
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
    
</script>

<style scoped>
.slider-input-wrapper {
    border: 1px solid transparent;
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
  