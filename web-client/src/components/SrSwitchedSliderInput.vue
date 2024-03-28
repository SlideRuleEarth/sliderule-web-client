<template>
    <div class="sr-switched-slider-input-wrapper">
        <SrCheckbox v-model="isCheckboxChecked" :label="props.checkBoxLabel"  @change="handleChange" :insensitive="insensitive"/>
        <SrSliderInput v-model="innerModelValue" :label="props.label" :id="inputID" :min="min"  :max="max" :decimalPlaces="decimalPlaces" :insensitive="!isCheckboxChecked || insensitive"/>
    </div>
</template>
  
<script setup lang="ts">
    import { ref } from 'vue';
    import SrSliderInput from './SrSliderInput.vue';
    import SrCheckbox from './SrCheckbox.vue';

    const props = defineProps({
        selected: {
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
            default: ''
        },
        checkBoxLabel: {
            type: String,
            default: ''
        },
        decimalPlaces: {
            type: Number,
            default: 0 // Default to 0 decimal places
        },
        insensitive: {
            type: Boolean,
            default: false
        }
    });

    const emit = defineEmits(['update:selected']);

    const innerModelValue = ref(0.0);
    const isCheckboxChecked = ref(false);
    const inputID = `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;
    const handleChange = (event: any) => {
        console.log(`SrSwitchedSliderInput ${props.checkBoxLabel} ${props.label} checked?: ${event.target.checked}`);
        isCheckboxChecked.value = event.target.checked;
        emit('update:selected', event.target.checked);
    }
</script>

<style scoped>
</style>
  