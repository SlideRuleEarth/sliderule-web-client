<template>
    <div class="sr-swithced-slider-input-wrapper">
        <div class="sr-switched-slider-row">
            <SrCheckbox v-model="isCheckboxChecked" :label="props.checkBoxLabel"  @change="handleChange" :insensitive="insensitive"/>
            <SrSliderInput v-model="innerModelValue" :label="props.label" :id="inputID" :min="min"  :max="max" :decimalPlaces="decimalPlaces" :insensitive="!isCheckboxChecked || insensitive"/>
        </div>
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
.sr-switched-slider-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.0625rem solid var(transparent);
    border-radius: var(--border-radius);
}

.sr-switched-slider-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}
.sr-switched-slider-checkbox-label {
    white-space: nowrap;
}

.sr-switched-slider-checkbox-label-insensitive {
    white-space: nowrap;
    color: #888; /*  grey color */
}
</style>
  