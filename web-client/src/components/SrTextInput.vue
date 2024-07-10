<template>
    <div class="sr-text-input-wrapper">
      <div class="sr-text-row ">
            <SrLabelInfoIconButton :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive" :labelFontSize="labelFontSize"/>
            <InputText v-model="modelValueComputed" class="input-text" id={{label}}_text :disabled="insensitive"/>
        </div>
    </div>
</template>

<script setup lang="ts">

    import { computed } from 'vue';
    import InputText from 'primevue/inputtext';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

    const props = defineProps({
        modelValue: {
            type: String,
            required: true
        },
        label: {
            type: String,
            default: 'Label'
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
        labelFontSize: {
            type: String,
            default: 'small' // default font size if not passed
        },
    });

    const emit = defineEmits(['update:modelValue']);

    // Create a computed with both getter and setter for modelValue
    const modelValueComputed = computed({
        get: () => props.modelValue, // Getter simply returns the current prop value
        set: (newValue) => {
            emit('update:modelValue',newValue); // Emit the update event with the new value);
        }
    });
</script>

<style scoped>
.sr-text-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.125rem solid transparent;
    border-radius: var(--p-border-radius);
    margin-top: 0.125rem;
    font-size: small;
}

.sr-text-row  {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}
.sr-text-input-label {
    margin-right: 0.5rem;
    font-size: small;
    white-space: nowrap;
}
.sr-text-input-label-insensitive {
    margin-right: 0.5rem;
    font-size: small;
    white-space: nowrap;
    color: #888; /*  grey color */
}

.input-text {
    width: 15em; /* Adjust as needed for 5 digits */
    text-align: right;
    padding: 0.25rem;
}


</style>
