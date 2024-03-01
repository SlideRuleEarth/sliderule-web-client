<template>
    <div class="text-input-wrapper">
      <div class="text-row">
            <label for="{{label}}_text" class="label">{{ label }}</label>
            <InputText v-model="modelValueComputed" class="input-text" id={{label}}_text />
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
        }
    });

    const emit = defineEmits(['update:modelValue']);

    // Create a computed with both getter and setter for modelValue
    const modelValueComputed = computed({
        get: () => props.modelValue, // Getter simply returns the current prop value
        set: (newValue) => {
            emit('update:modelValue', newValue); // Setter emits an update event
        }
    });
</script>

<style scoped>
.text-input-wrapper {
    border: 1px solid transparent;
    border-top: 0.125rem solid transparent;
    border-radius: var(--border-radius);
    margin-top: 0.125rem;
}

.text-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem ;
}
.label {
    margin-right: 0.5rem;
}


.input-text {
    width: 15em; /* Adjust as needed for 5 digits */
    text-align: right;
    padding: 0.25rem;
}


</style>
