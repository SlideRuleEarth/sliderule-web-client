<template>
    <div class="sr-calendar">
        <SrLabelInfoIconButton :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive"/>
        <DatePicker v-model="innerModelValue" showIcon showTime showSeconds hourFormat="24" timeSeperator=':' :showOnFocus="false" :inputId="inputId" dateFormat="yy-mm-ddT" :disabled="insensitive" :minDate="useReqParamsStore().minDate"/>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DatePicker from 'primevue/datepicker';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const props = defineProps({
    label: {type:String,
        default: 'undefined'
    },
    getValue: {
        type: Function,
        required: true
    },
    setValue: {
        type: Function,
        required: true
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
    default: {
        type: Date,
    }
});

const innerModelValue = computed({
        get(): Date {
            const value = props.getValue();
            console.log('SrCalendar:', props.label, 'get:', value, typeof value);
            console.log(`SrCalendar: ${value}`);
            return value; // calling the getter function
        },
        set(value: Date) {
            console.log('SrCalendar:', props.label, 'set:', value, typeof value);
            props.setValue(value); // calling the setter function
        }
    });


const emit = defineEmits(['update:modelValue']);

// Generate a unique inputId based on the label prop
const inputId = `sr-calendar-${props.label.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').replace(/\s+/g, '-')}`;

function handleChange(event:any) {
    console.log(`${props.label} SrCheckbox: ${event.target.checked}`);
    emit('update:modelValue', event.target.checked);
}
</script>

<style scoped>
.sr-calendar {
    display: flex;
    justify-content: space-between;
    margin: 0.25rem;
    padding: 0.125rem;
    font-size: small;
}

:deep(.p-datepicker.trigger) {
    width: 100%;
}
:deep(.p-button-icon-only) {
    width: 2.0rem;
    height: 1.0rem;
}
:deep( .p-inputtext) {
    width: 100%;
    height: 1.5rem;
    font-size: small;
}

:deep(.p-button){
    border-color: grey;
    color:white;
    background-color: transparent;
}
</style>
