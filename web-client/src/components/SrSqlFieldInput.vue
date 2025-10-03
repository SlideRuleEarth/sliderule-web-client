<template>
    <div class="sr-sql-field-input-wrapper">
      <div class="sr-text-row">
            <SrLabelInfoIconButton :label="label" :tooltipText="tooltipText" :tooltipUrl="tooltipUrl" :insensitive="insensitive" :labelFontSize="labelFontSize"/>
            <InputText v-model="modelValueComputed" class="input-text" :id="`${label}_text`" :disabled="insensitive" @blur="handleBlur"/>
            <span v-if="showWarning" class="warning-icon" :title="warningMessage">⚠️</span>
        </div>
    </div>
</template>

<script setup lang="ts">

    import { computed, ref } from 'vue';
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

    const showWarning = ref(false);
    const warningMessage = ref('');

    /**
     * Sanitize input for SQL field names
     * - Allow only alphanumeric characters and underscores
     * - Convert dashes to underscores
     * - Remove other special characters
     * - Ensure it starts with a letter or underscore
     */
    function sanitizeSqlFieldName(value: string): string {
        if (!value) return value;

        // Replace dashes with underscores
        let sanitized = value.replace(/-/g, '_');

        // Remove any characters that are not alphanumeric or underscore
        sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');

        // If it starts with a number, prepend an underscore
        if (/^\d/.test(sanitized)) {
            sanitized = '_' + sanitized;
        }

        return sanitized;
    }

    /**
     * Check if the value needs sanitization
     */
    function needsSanitization(value: string): boolean {
        if (!value) return false;

        // Check for invalid characters for SQL field names
        if (/[^a-zA-Z0-9_]/.test(value)) {
            return true;
        }

        // Check if starts with a number
        if (/^\d/.test(value)) {
            return true;
        }

        return false;
    }

    // Create a computed with both getter and setter for modelValue
    const modelValueComputed = computed({
        get: () => props.modelValue, // Getter simply returns the current prop value
        set: (newValue) => {
            // Check if sanitization is needed
            if (needsSanitization(newValue)) {
                showWarning.value = true;
                warningMessage.value = 'Field name contains invalid characters for SQL. Will be sanitized on blur.';
            } else {
                showWarning.value = false;
                warningMessage.value = '';
            }
            emit('update:modelValue', newValue); // Emit the update event with the new value
        }
    });

    // Handle blur event to sanitize the input
    function handleBlur() {
        if (needsSanitization(props.modelValue)) {
            const sanitized = sanitizeSqlFieldName(props.modelValue);
            emit('update:modelValue', sanitized);
            showWarning.value = false;
            warningMessage.value = '';
        }
    }
</script>

<style scoped>
.sr-sql-field-input-wrapper {
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
    padding: 0.125rem;
    gap: 0.5rem;
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

.warning-icon {
    font-size: 1.2rem;
    color: #ff9800;
    cursor: help;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}
</style>
