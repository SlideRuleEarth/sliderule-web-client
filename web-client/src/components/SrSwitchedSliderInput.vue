<template>
    <div class="sr-switched-slider-input-wrapper">
        <div class="sr-switched-slider-labeled-cb">
            <SrCheckbox v-model="isCheckboxChecked" label=""  @change="handleChange" :insensitive="insensitive"/>
            <label :class="{ 'sr-switched-slider-label': !insensitive, 'sr-switched-slider-label-insensitive': insensitive }" :for="inputId" :title="tooltipText">{{ label }}</label>
            <Button icon="pi pi-info-circle" class="p-button-rounded p-button-text p-button-plain sr-info-button " :title="tooltipText"></Button>
        </div>
        <SrSliderInput v-model="innerModelValue" label="" :id="inputId" :min="min"  :max="max" :decimalPlaces="decimalPlaces" :insensitive="!isCheckboxChecked || insensitive"/>
    </div>
</template>
  
<script setup lang="ts">
    import { ref } from 'vue';
    import SrSliderInput from './SrSliderInput.vue';
    import SrCheckbox from './SrCheckbox.vue';
    import Button from 'primevue/button';

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
        },
        tooltipText: {
            type: String,
            default: 'Some tooltip text here'
        }
    });

    const emit = defineEmits(['update:selected']);

    const innerModelValue = ref(0.0);
    const isCheckboxChecked = ref(false);
    const inputId = `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;
    const handleChange = (event: any) => {
        console.log(`SrSwitchedSliderInput ${props.checkBoxLabel} ${props.label} checked?: ${event.target.checked}`);
        isCheckboxChecked.value = event.target.checked;
        emit('update:selected', event.target.checked);
    }
</script>

<style scoped>
.sr-switched-slider-input-wrapper {
    display: flex;
    flex-direction: column;
    align-items: self-start;
    justify-content: left;
    font-size: small;
    margin: 0rem;
    margin-top: 0.125rem;
}
.sr-switched-slider-labeled-cb {
    display: flex;
    align-items: center;
    justify-content: left;
    margin: 0rem;
    margin-bottom: -0.6rem;
    margin-left: -0.125rem;

}
.sr-switchedslider-label {
    white-space: nowrap;
    font-size: small;
}
.sr-switched-slider-label-insensitive {
    white-space: nowrap;
    color: #888; /*  grey color */
    font-size: small;
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
  