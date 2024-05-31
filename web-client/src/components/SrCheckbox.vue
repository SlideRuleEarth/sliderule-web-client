<template>
    <div class="sr-checkbox">
        <template v-if="labelOnRight">
            <input 
                :id="'sr-checkbox-' + label" 
                type="checkbox" 
                v-model="checked" 
                :disabled="insensitive"
                @change="emitChange"
            />
        </template>
        <template v-if="tooltipText || tooltipUrl">
            <SrLabelInfoIconButton 
                :label="label" 
                :tooltipText="tooltipText" 
                :tooltipUrl="tooltipUrl" 
                :insensitive="insensitive" 
                :labelFontSize="labelFontSize"
            />
        </template>
        <template v-else>
            <label 
                :for="'sr-checkbox-' + label" 
                :class="['sr-checkbox-label', { 'sr-checkbox-label-insensitive': insensitive }]"
                :style="{ fontSize: labelFontSize }"
            >
                {{ label }}
            </label>
        </template>
        <template v-if="!labelOnRight">
            <input 
                :id="'sr-checkbox-' + label" 
                type="checkbox" 
                v-model="checked" 
                :disabled="insensitive"
                @change="emitChange"
            />
        </template>

    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    modelValue: {
        type: Boolean,
        default: false
    },
    insensitive: {
        type: Boolean,
        default: false
    },
    tooltipText: {
        type: String,
        default: ''
    },
    tooltipUrl: {
        type: String,
        default: ''
    },
    labelFontSize: {
        type: String,
        default: 'small'
    },
    labelOnRight: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);
const checked = ref(props.modelValue);

watch(checked, (newValue) => {
    emit('update:modelValue', newValue);
});

const emitChange = () => {
    console.log(`SrCheckbox: ${props.label}: ${checked.value}`);
};
</script>

<style scoped>
.sr-checkbox {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin: 0.25rem;
}

.sr-checkbox-label {
    white-space: nowrap;
    font-size: small;
}

.sr-checkbox-label-insensitive {
    white-space: nowrap;
    color: #888; /* grey color */
}
</style>
