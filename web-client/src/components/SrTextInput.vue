<template>
    <div class="sr-text-input-wrapper">
      <div class="sr-text-row ">
            <label for="{{label}}_text" :class="{'sr-text-input-label':!insensitive, 'sr-text-input-label-insensitive':insensitive }" :insensitive="insensitive">{{ label }}</label>
            <InputText v-model="modelValueComputed" class="input-text" id={{label}}_text :disabled="insensitive"/>
        </div>
    </div>
</template>

<script setup lang="ts">

    import { computed } from 'vue';
    import InputText from 'primevue/inputtext';


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
        }
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
    border-radius: var(--border-radius);
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
