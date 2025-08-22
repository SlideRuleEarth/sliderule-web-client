<template>
    <div class="sr-switched-slider-input-wrapper">
        <div class="sr-switched-slider-labeled-cb">
            <SrCheckbox v-model="computedCheckboxValue" label=""  :insensitive="props.insensitive"/>
            <SrLabelInfoIconButton :label="props.label" :tooltipText="props.tooltipText" :tooltipUrl="props.tooltipUrl" :insensitive="props.insensitive"/>
        </div>
        <div class="sr-slider">
            <SrSliderInput 
                v-model="innerModelValue" 
                label="" 
                :id="inputId" 
                :min="min"  
                :max="max"
                :sliderMin="sliderMin"
                :sliderMax="sliderMax" 
                :decimalPlaces="decimalPlaces" 
                :insensitive="!computedCheckboxValue || props.insensitive" 
                :tooltipText="tooltipText" 
                :sliderWidth="props.sliderWidth" 
            />
        </div>
    </div>
</template>
  
<script setup lang="ts">
    import { onMounted,computed } from 'vue';
    import SrSliderInput from './SrSliderInput.vue';
    import SrCheckbox from './SrCheckbox.vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
    const props = defineProps({
        getValue: {
            type: Function,
            required: true
        },
        setValue: {
            type: Function,
            required: true
        },
        getCheckboxValue: {
            type: Function,
            required: true
        },
        setCheckboxValue: {
            type: Function,
            required: true
        },
        min: {
            type: Number,
            default: 0.0
        },
        max: {
            type: Number,
            default: 100.0
        },
        sliderMin: { type: Number },
        sliderMax: { type: Number },
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
            default: 'tooltip text'
        },
        tooltipUrl: {
            type: String,
            default: ''
        },
        sliderWidth: {
            type: [String, Number],
            default: '12rem'
        },
        defaultValue: {
            type: Number,
            default: 0
        },
        currentCheckboxValue: {
            type: Boolean,
            default: false
        }
    });
    const combinedLabel = computed(() => {
        return `${props.label} ${props.checkBoxLabel ? `(${props.checkBoxLabel})` : ''}`;
    }); 
    const innerModelValue = computed({
        get() {
            const value = props.getValue();
            //console.log('SrSwitchedSliderInput:', combinedLabel.value, 'get:', value);
            return value; // calling the getter function
        },
        set(value) {
            //console.log('SrSwitchedSliderInput:', combinedLabel.value, 'set:', value)
            props.setValue(value); // calling the setter function
        }
    });
    const inputId = `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;

    const computedCheckboxValue = computed({
        get() {
            const value = props.getCheckboxValue();
            //console.log('SrSwitchedSliderInput ccv:', combinedLabel.value, 'get:', value);
            return value; // calling the getter function
        },
        set(value) {
            //console.log('SrSwitchedSliderInput ccv:', combinedLabel.value, 'set:', value)
            props.setCheckboxValue(value); // calling the setter function
        }
    });

    onMounted(() => {
        //console.log('Mounted SrSwitchedSliderInput:', combinedLabel.value, 'insensitive:', props.insensitive);
        // Initialize the slider value based on the checkbox state
        const currentCheckboxValue = props.currentCheckboxValue;
        const defaultValue = props.defaultValue;
        //console.log('SrSwitchedSliderInput:', combinedLabel.value,'currentCheckboxValue:', currentCheckboxValue, 'defaultValue:', defaultValue);
        if(!currentCheckboxValue) {// 'use' is falsey
            if( defaultValue === undefined || defaultValue === null || defaultValue < props.min) {
                console.error('SrSwitchedSliderInput:', combinedLabel.value, 'defaultValue is undefined or null, or < min:',props.defaultValue);
            }
            if(props.defaultValue >= props.min) {
                props.setValue(defaultValue);
                //console.log('SrSwitchedSliderInput:', combinedLabel.value, 'setValue:', props.defaultValue);
                innerModelValue.value = defaultValue;
            }
        } else {
            const value = props.getValue();
            //console.log('SrSwitchedSliderInput:', combinedLabel.value, 'value:', value);
            innerModelValue.value = value;
        }
       props.setCheckboxValue(currentCheckboxValue);
});
</script>

<style scoped>
.sr-switched-slider-input-wrapper {
    display: flex;
    flex-direction: column;
    align-items: self-start;
    justify-content: left;
    font-size: small;
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
.sr-slider{
    padding:0.125rem;
}
</style>
  