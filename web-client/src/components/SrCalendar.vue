<template>
    <div class="sr-calendar">
        <label class="sr-calendar-label" :for="inputId"> {{ label }} </label>
        <Calendar v-model="dateDisplay" showIcon showTime hourFormat="24" :showOnFocus="false" :inputId="inputId" dateFormat="yy-m-dT"/>
    </div>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import Calendar from 'primevue/calendar';

const props = defineProps({
    label: {type:String,
        default: 'undefined'
    },
    default: {
        type: Date,
    }
});

const dateDisplay = ref();


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
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
}
.sr-calendar-label {
    margin-right: 0.25rem;
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
}

</style>
