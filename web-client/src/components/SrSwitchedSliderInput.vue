<template>
    <div class="sr-switched-slider-input-wrapper">
        <div class="sr-switched-slider-labeled-cb">
            <SrCheckbox v-model="computedCheckboxValue" label=""  :insensitive="props.insensitive"/>
            <SrLabelInfoIconButton :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive"/>
        </div>
        <SrSliderInput v-model="innerModelValue" label="" :id="inputId" :min="min"  :max="max" :decimalPlaces="decimalPlaces" :insensitive="!computedCheckboxValue || insensitive" :tooltipText="tooltipText"  />
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
        }
    });

    //const emit = defineEmits(['update:selected']);

    const innerModelValue = computed({
        get() {
            const value = props.getValue();
            //console.log('SrSwitchedSlider:', props.label, 'get:', value);
            return value; // calling the getter function
        },
        set(value) {
            //console.log('SrSwithcedSlider:', props.label, 'set:', value)
            props.setValue(value); // calling the setter function
        }
    });
    const inputId = `sr-slider-input-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;

    const computedCheckboxValue = computed({
        get() {
            const value = props.getCheckboxValue();
            //console.log('SrSwitchedSlider:', props.checkBoxLabel, 'get:', value);
            return value; // calling the getter function
        },
        set(value) {
            //console.log('SrSwithcedSlider:', props.checkBoxLabel, 'set:', value)
            props.setCheckboxValue(value); // calling the setter function
        }
    });

    //const computedCheckboxValue = ref(false);
    // const handleChange = (event: any) => {
    //     console.log(`SrSwitchedSliderInput ${props.checkBoxLabel} ${props.label} checked?: ${event.target.checked}`);
    //     computedCheckboxValue.value = event.target.checked;
    //     emit('update:selected', event.target.checked);
    // }

    onMounted(() => {
        console.log('Mounted SrSwitchedSliderInput:', props.label, 'insensitive:', props.insensitive);  
    });
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

</style>
  